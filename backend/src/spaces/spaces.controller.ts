import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { SpacesService } from './spaces.service'
import { CreateSpaceDto, JoinSpaceDto, SearchQueryDto, TimelineQueryDto, TransferOwnerDto, UpdateSpaceDto } from './dto'

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get('mine')
  getMine(@CurrentUser() user: AuthUser) {
    return this.spacesService.getMine(user.id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpaceDto) {
    return this.spacesService.create(user.id, dto)
  }

  @Get(':id/access')
  getAccessInfo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spacesService.getAccessInfo(user.id, Number(id))
  }

  @Get(':id')
  getDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spacesService.getDetail(user.id, Number(id))
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSpaceDto) {
    return this.spacesService.update(user.id, Number(id), dto)
  }

  @Post(':id/transfer-owner')
  transferOwner(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TransferOwnerDto) {
    return this.spacesService.transferOwner(user.id, Number(id), dto.memberId)
  }

  @Post(':id/join')
  join(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: JoinSpaceDto) {
    return this.spacesService.join(user.id, Number(id), dto.openGid ?? null)
  }

  @Post(':id/invites')
  createInvite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spacesService.createInvite(user.id, Number(id))
  }

  @Post('invites/:token/accept')
  acceptInvite(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.spacesService.acceptInvite(user.id, token)
  }

  @Get(':id/members')
  getMembers(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spacesService.getMembers(user.id, Number(id))
  }

  @Get(':id/member-requests')
  getPendingMembers(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spacesService.getPendingMembers(user.id, Number(id))
  }

  @Post(':id/member-requests/:memberId/approve')
  approveMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.spacesService.reviewMember(user.id, Number(id), Number(memberId), true)
  }

  @Post(':id/member-requests/:memberId/reject')
  rejectMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.spacesService.reviewMember(user.id, Number(id), Number(memberId), false)
  }

  @Get(':id/timeline')
  getTimeline(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: TimelineQueryDto) {
    return this.spacesService.getTimeline(user.id, Number(id), q.slice ?? 'month', q.page ?? 1)
  }

  @Get(':id/search')
  search(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: SearchQueryDto) {
    return this.spacesService.search(user.id, Number(id), q.q ?? '')
  }
}
