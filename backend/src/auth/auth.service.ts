import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { userToDto } from '../common/mappers'
import { WechatService } from './wechat.service'
import type { GroupInfoResult, SessionDto, UserDto } from '../types/api'
import { randomBytes } from 'crypto'

const SESSION_TTL_DAYS = 30

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wechat: WechatService,
  ) {}

  /** 微信登录：code → openid → upsert user + identity → 下发不透明会话 token（ADR-0004） */
  async login(code: string): Promise<SessionDto> {
    const { openid, unionid, sessionKey } = await this.wechat.code2session(code)

    let identity = await this.prisma.userIdentity.findUnique({
      where: { uk_provider_openid: { provider: 'wechat', openid } },
    })

    let user
    if (!identity) {
      user = await this.prisma.user.create({ data: { nickname: null, avatarUrl: null } })
      identity = await this.prisma.userIdentity.create({
        data: { userId: user.id, provider: 'wechat', openid, unionid },
      })
    } else {
      user = await this.prisma.user.findUniqueOrThrow({ where: { id: identity.userId } })
      // 顺带补 unionid（ADR-0004 跨应用归并键）
      if (unionid && identity.unionid !== unionid) {
        await this.prisma.userIdentity.update({ where: { id: identity.id }, data: { unionid } })
      }
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 864e5)
    await this.prisma.session.create({ data: { token, userId: user.id, sessionKey, expiresAt } })

    return { token, user: userToDto(user) }
  }

  /**
   * 解密群上下文（ADR-0008）：用当前会话的 sessionKey 解出 openGId。
   * sessionKey 由 AuthGuard 从 token 对应的 session 行注入（dev 模式为空串 → mock 派生）。
   */
  async groupInfo(sessionKey: string, input: { shareTicket: string; encryptedData?: string; iv?: string }): Promise<GroupInfoResult> {
    const { openGId } = await this.wechat.decryptGroupInfo(
      sessionKey,
      input.shareTicket,
      input.encryptedData ?? '',
      input.iv ?? '',
    )
    return { openGid: openGId }
  }

  /** 更新昵称/头像（微信头像昵称填写，roadmap §四） */
  async updateProfile(userId: number, input: { nickname?: string; avatarUrl?: string | null }): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: input.nickname ?? undefined,
        avatarUrl: input.avatarUrl ?? undefined,
      },
    })
    return userToDto(user)
  }
}
