import { Controller, Get, Param, Query } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsInt, IsOptional } from 'class-validator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { AggregatesService } from './aggregates.service'

class FeedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1
}

class StarTrailQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  spaceId?: number
}

@Controller()
export class AggregatesController {
  constructor(private readonly aggregatesService: AggregatesService) {}

  @Get('feed')
  getFeed(@CurrentUser() user: AuthUser, @Query() q: FeedQueryDto) {
    return this.aggregatesService.getFeed(user.id, q.page ?? 1)
  }

  @Get('users/:userId/star-trail')
  getStarTrail(@CurrentUser() user: AuthUser, @Param('userId') targetId: string, @Query() q: StarTrailQueryDto) {
    return this.aggregatesService.getStarTrail(user.id, Number(targetId), q.spaceId)
  }
}
