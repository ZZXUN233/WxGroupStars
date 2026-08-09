import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number | null

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  replyToUserId?: number | null
}
