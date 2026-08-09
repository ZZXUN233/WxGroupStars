import { Body, Controller, Post } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { UploadsService } from './uploads.service'

export class PresignDto {
  /** 原始文件名（用于推断扩展名 / 类型白名单） */
  @IsString()
  @IsNotEmpty()
  filename: string
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** 签发 COS 直传签名（ADR-0005）：返回 { key, url, fields }，前端 Taro.uploadFile 直传 */
  @Post('presign')
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.uploads.presign(user.id, dto.filename)
  }
}
