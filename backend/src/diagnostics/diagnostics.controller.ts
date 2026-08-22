import { Body, Controller, Post } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import { Public } from '../common/decorators/public.decorator'
import { ClientErrorDto } from './dto'
import { DiagnosticsService } from './diagnostics.service'

@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Public()
  @Post('client-error')
  report(@CurrentUser() user: AuthUser | undefined, @Body() dto: ClientErrorDto) {
    return this.diagnostics.report(user, dto)
  }
}
