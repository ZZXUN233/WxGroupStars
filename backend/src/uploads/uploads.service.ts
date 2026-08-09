import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, createHmac, randomBytes } from 'crypto'

/** 媒体类型白名单（ADR-0005：图片/音视频单文件或图片多张，扩展名决定归属） */
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.avi', '.webm']
const AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg']
const ALLOWED_EXT = [...IMAGE_EXT, ...VIDEO_EXT, ...AUDIO_EXT]

/** 预签名直传结果：url + fields 交给前端 Taro.uploadFile（multipart POST） */
export interface PresignResult {
  /** COS object key（落库用） */
  key: string
  /** COS 表单 POST 目标（bucket 根路径） */
  url: string
  /** 表单签名字段，作为 uploadFile 的 formData */
  fields: Record<string, string>
}

/**
 * 媒体直传签名（ADR-0005：前端直传 COS，流量不过后端）。
 * 签名规范见腾讯云 COS「POST Object」：StringToSign = SHA1(policy 原文)，
 * SignKey = HMAC-SHA1(SecretKey, keyTime)，Signature = HMAC-SHA1(SignKey, StringToSign)。
 */
@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  presign(userId: number, filename: string): PresignResult {
    const ext = this.safeExt(filename)
    const bucket = this.config.getOrThrow<string>('COS_BUCKET')
    const secretId = this.config.getOrThrow<string>('COS_SECRET_ID')
    const secretKey = this.config.getOrThrow<string>('COS_SECRET_KEY')
    const baseUrl = this.config.get<string>('COS_BASE_URL', '').replace(/\/+$/, '')
    if (!baseUrl) throw new Error('COS_BASE_URL 未配置')

    const key = `works/${userId}/${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
    const now = Math.floor(Date.now() / 1000)
    const end = now + 3600
    const keyTime = `${now};${end}`

    const policy = JSON.stringify({
      expiration: new Date(end * 1000).toISOString(),
      conditions: [
        { bucket },
        // 只允许写入本用户目录，签名无法被复用去覆盖他人对象
        ['starts-with', '$key', `works/${userId}/`],
        { 'q-sign-algorithm': 'sha1' },
        { 'q-ak': secretId },
        { 'q-sign-time': keyTime },
      ],
    })
    const policyB64 = Buffer.from(policy, 'utf8').toString('base64')
    const signKey = createHmac('sha1', secretKey).update(keyTime, 'utf8').digest('hex')
    const stringToSign = createHash('sha1').update(policy, 'utf8').digest('hex')
    const signature = createHmac('sha1', signKey).update(stringToSign, 'utf8').digest('hex')

    return {
      key,
      url: `${baseUrl}/`,
      fields: {
        key,
        policy: policyB64,
        'q-sign-algorithm': 'sha1',
        'q-ak': secretId,
        'q-key-time': keyTime,
        'q-sign-time': keyTime,
        'q-signature': signature,
      },
    }
  }

  /** 扩展名白名单校验（大小写归一） */
  private safeExt(filename: string): string {
    const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[0]
    if (!ext || !ALLOWED_EXT.includes(ext)) {
      throw new BadRequestException(`不支持的媒体类型（允许 ${ALLOWED_EXT.join(' ')}）`)
    }
    return ext
  }
}
