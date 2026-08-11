import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { AppendProjectionDto, UpsertWorkDto } from './dto'
import { WorksService } from './works.service'

@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  // 静态路由需先于 :id 声明，否则 "drafts" 会被当作 id 捕获
  @Get('drafts')
  getMyDrafts(@CurrentUser() user: AuthUser) {
    return this.worksService.getMyDrafts(user.id)
  }

  @Get(':id')
  getDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.worksService.getDetail(user.id, Number(id))
  }

  @Post()
  publish(@CurrentUser() user: AuthUser, @Body() dto: UpsertWorkDto) {
    return this.worksService.publish(user.id, dto)
  }

  @Patch(':id')
  edit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpsertWorkDto) {
    return this.worksService.edit(user.id, Number(id), dto)
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.worksService.remove(user.id, Number(id))
  }

  @Post(':id/projections')
  appendProjection(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AppendProjectionDto) {
    return this.worksService.appendProjection(user.id, Number(id), dto.spaceId)
  }
}
