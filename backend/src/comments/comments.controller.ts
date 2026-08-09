import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { CreateCommentDto } from './dto'
import { CommentsService } from './comments.service'

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('projections/:id/comments')
  getByProjection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commentsService.getByProjection(user.id, Number(id))
  }

  @Post('projections/:id/comments')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(user.id, Number(id), dto)
  }

  @Delete('comments/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commentsService.remove(user.id, Number(id))
  }
}
