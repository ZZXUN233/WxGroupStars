import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  code: string
}

/** 群信息解密入参（ADR-0008）：shareTicket 溯源；encryptedData/iv 为 wx.getShareInfo 产物，dev 模式可缺省 */
export class GroupInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  shareTicket: string

  @IsOptional()
  @IsString()
  encryptedData?: string

  @IsOptional()
  @IsString()
  iv?: string
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string | null
}
