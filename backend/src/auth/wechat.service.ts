import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createDecipheriv, createHash } from 'crypto'

export interface WechatSession {
  openid: string
  sessionKey: string
  unionid: string | null
}

export interface DecryptedGroupInfo {
  openGId: string
}

/**
 * 微信 code2session（ADR-0004：MVP 独立完成登录）。
 * 未配置 WX_APPID/WX_SECRET 时进入开发模式：code 直接作为 openid，
 * 便于本地/联调环境无真实微信凭据也能跑通全链路。
 */
@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name)

  constructor(private readonly config: ConfigService) {}

  async code2session(code: string): Promise<WechatSession> {
    const appid = this.config.get<string>('WX_APPID', '')
    const secret = this.config.get<string>('WX_SECRET', '')

    if (!appid || !secret) {
      // 生产环境必须配置微信凭据，否则拒绝启动（安全审计 C-1）
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('服务配置异常，请联系管理员')
      }
      // dev 模式身份必须稳定：微信开发者工具每次重编译 code 都会变，
      // 若直接 dev_${code} 会导致「每次登录都是新用户」、旧群/作品全部丢失。
      // 固定 openid（.env 的 DEV_OPENID 可覆盖），模拟多用户时手动改值即可。
      const openid = this.config.get<string>('DEV_OPENID', 'dev_local')
      this.logger.warn(`WX_APPID/WX_SECRET 未配置 → 开发模式（固定身份 openid=${openid}）`)
      return { openid, sessionKey: '', unionid: null }
    }

    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`

    const res = await fetch(url)
    const data = (await res.json()) as {
      openid?: string
      session_key?: string
      unionid?: string
      errcode?: number
      errmsg?: string
    }

    if (!data.openid || data.errcode) {
      this.logger.error(`code2session 失败: ${data.errcode} ${data.errmsg}`)
      throw new UnauthorizedException('微信登录失败，请重试')
    }
    return { openid: data.openid, sessionKey: data.session_key ?? '', unionid: data.unionid ?? null }
  }

  /**
   * 解密群信息（ADR-0008）：shareTicket → openGId。
   * 微信规定 openGId 只能由 session_key 在服务端解出，前端拿不到明文。
   * - 真实模式：wx.getShareInfo 返回的 encryptedData 为 AES-128-CBC（PKCS7），
   *   key = base64 解码后的 session_key（微信 session_key 为 24 字节，AES-128 取前 16 字节），
   *   iv 由前端原样传入；解密得到 { openGId, watermark }。
   * - dev 模式（无 session_key）：shareTicket 直接派生稳定 openGId，
   *   让本地联调也能验证门禁的「绑定/拦截」分支，真实部署同一端点走真解密。
   */
  async decryptGroupInfo(
    sessionKey: string,
    shareTicket: string,
    encryptedData: string,
    iv: string,
  ): Promise<DecryptedGroupInfo> {
    if (!sessionKey) {
      const openGId = `dev_${createHash('sha256').update(shareTicket || 'unknown').digest('hex').slice(0, 24)}`
      this.logger.warn(`dev 模式 mock 解密群信息 → openGId=${openGId}`)
      return { openGId }
    }
    if (!encryptedData || !iv) {
      throw new UnauthorizedException('缺少群信息密文')
    }

    try {
      const key = Buffer.from(sessionKey, 'base64').slice(0, 16)
      const decipher = createDecipheriv('aes-128-cbc', key, Buffer.from(iv, 'base64'))
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedData, 'base64')),
        decipher.final(), // 默认 PKCS7 padding
      ])
      const payload = JSON.parse(decrypted.toString('utf8')) as { openGId?: string }
      if (!payload.openGId) throw new Error('解密结果缺少 openGId')
      return { openGId: payload.openGId }
    } catch (err) {
      this.logger.error(`群信息解密失败: ${(err as Error).message}`)
      throw new UnauthorizedException('群信息解密失败，请重新进入')
    }
  }
}
