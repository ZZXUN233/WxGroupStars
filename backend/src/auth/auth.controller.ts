import { Body, Controller, Get, Patch, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { AuthService } from './auth.service'
import { GroupInfoDto, LoginDto, UpdateProfileDto } from './dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.code)
  }

  /** 群上下文解密（ADR-0008）：shareTicket → openGId，门禁加入前调用 */
  @Post('group-info')
  groupInfo(@CurrentUser() user: AuthUser, @Body() dto: GroupInfoDto) {
    return this.authService.groupInfo(user.sessionKey, dto)
  }

  /** 当前用户最新资料（昵称/头像可能已改，进入编辑资料页时拉最新） */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id)
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto)
  }
}
