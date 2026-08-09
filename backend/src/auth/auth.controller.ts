import { Body, Controller, Patch, Post } from '@nestjs/common'
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

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto)
  }
}
