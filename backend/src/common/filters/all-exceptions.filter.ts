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

    let message = '服务器开小差了'
    if (exception instanceof HttpException) {
      const body = exception.getResponse()
      const raw = typeof body === 'string' ? body : (body as any).message ?? exception.message
      message = Array.isArray(raw) ? raw.join('；') : String(raw)
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : exception)
    }

    response.status(status).json({ code: status, message, data: null })
  }
}
