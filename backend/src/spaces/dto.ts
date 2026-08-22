import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import type { TimelineSlice } from '../types/api'

export class CreateSpaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverUrl?: string | null
}

export class UpdateSpaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverUrl?: string | null
}

export class TransferOwnerDto {
  @IsInt()
  memberId: number
}

export class SetAdminDto {
  @IsBoolean()
  admin: boolean
}

export class JoinSpaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  openGid?: string | null
}

export class TimelineQueryDto {
  @IsOptional()
  @IsIn(['today', 'week', 'month', 'year'])
  slice: TimelineSlice = 'month'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page: number = 1
}

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  q: string = ''
}
