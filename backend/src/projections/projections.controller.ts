import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { ProjectionsService } from './projections.service'

@Controller('projections')
export class ProjectionsController {
  constructor(private readonly projectionsService: ProjectionsService) {}

  @Get(':id')
  getDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectionsService.getDetail(user.id, Number(id))
  }

  @Post(':id/like')
  toggleLike(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectionsService.toggleLike(user.id, Number(id))
  }

  @Delete(':id')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projectionsService.revoke(user.id, Number(id))
  }
}
