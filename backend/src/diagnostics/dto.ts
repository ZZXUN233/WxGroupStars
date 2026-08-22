import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

const ERROR_STAGES = ['request', 'upload', 'save', 'login', 'render', 'unknown'] as const
export type ClientErrorStage = (typeof ERROR_STAGES)[number]

export class ClientErrorDto {
  @IsIn(ERROR_STAGES)
  stage: ClientErrorStage

  @IsString()
  @MaxLength(1000)
  message: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  page?: string

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>
}
