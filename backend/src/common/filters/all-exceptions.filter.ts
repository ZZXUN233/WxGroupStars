import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Response } from 'express'

/** 统一错误响应：{ code, message, data: null }，code 对齐 HTTP 状态码 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR
    const request = ctx.getRequest<Request & { method?: string; originalUrl?: string }>()
    const method = request.method ?? 'UNKNOWN'
    const path = request.originalUrl ?? request.url ?? 'UNKNOWN'

    let message = '服务器开小差了'
    let state: string | undefined
    if (exception instanceof HttpException) {
      const body = exception.getResponse()
      const raw = typeof body === 'string' ? body : (body as any).message ?? exception.message
      message = Array.isArray(raw) ? raw.join('；') : String(raw)
      // 结构化错误（如 ADR-0018 成员准入状态 pending/rejected/none）透传给前端渲染「无权限页」
      state = typeof body === 'object' && body !== null ? (body as any).state : undefined
      this.logger.warn(`[${method} ${path}] HTTP ${status}: ${message}`)
    } else {
      const detail = exception instanceof Error ? exception.stack ?? exception.message : String(exception)
      this.logger.error(`[${method} ${path}] HTTP ${status}: ${detail}`)
    }

    response.status(status).json(state ? { code: status, message, data: null, state } : { code: status, message, data: null })
  }
}
