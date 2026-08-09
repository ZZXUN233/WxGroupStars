import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator'
import type { WorkType } from '../types/api'

const WORK_TYPES = ['text', 'image', 'audio_video', 'tech', 'external'] as const

export class UpsertWorkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  title: string

  @IsIn(WORK_TYPES)
  type: WorkType

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  textContent?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  mediaKeys?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverKey?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(512)
  externalLink?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  techCode?: string | null

  @ValidateIf((o) => o.spaceIds !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  spaceIds?: number[]
}

export class AppendProjectionDto {
  @Type(() => Number)
  @IsInt()
  spaceId: number
}
