import { Injectable, Logger } from '@nestjs/common'
import type { AuthUser } from '../common/decorators/current-user.decorator'
import type { ClientErrorDto } from './dto'

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger('ClientDiagnostics')

  report(user: AuthUser | undefined, dto: ClientErrorDto): null {
    const prefix = `[CLIENT-${dto.stage.toUpperCase()}] user=${user?.id ?? 'anonymous'}`
    const page = dto.page ? ` page=${this.clean(dto.page)}` : ''
    const context = dto.context ? ` context=${this.clean(JSON.stringify(dto.context))}` : ''
    const detail = `${prefix}${page} message=${this.clean(dto.message)}${context}`

    if (dto.stage === 'upload' || dto.stage === 'save') {
      this.logger.error(dto.stack ? `${detail} stack=${this.clean(dto.stack)}` : detail)
    } else {
      this.logger.warn(detail)
    }
    return null
  }

  private clean(value: string): string {
    return value.replace(/[\r\n\t]/g, ' ').slice(0, 4000)
  }
}
