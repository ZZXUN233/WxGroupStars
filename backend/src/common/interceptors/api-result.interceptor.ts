import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Request, Response } from 'express'
import { Observable, map, tap } from 'rxjs'

/**
 * 统一成功响应包裹：controller 返回的 data → { code: 0, message: 'ok', data }。
 * 错误响应由 AllExceptionsFilter 处理。
 */
@Injectable()
export class ApiResultInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiResultInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>()
    const method = request.method
    const path = request.originalUrl ?? request.url
    const input = {
      query: request.query,
      params: request.params,
      body: request.body,
    }
    this.logger.log(`[IN] ${method} ${path} input=${formatForLog(input, true)}`)

    return next.handle().pipe(
      map((data) => ({ code: 0, message: 'ok', data: data ?? null })),
      tap((output) => {
        const response = context.switchToHttp().getResponse<Response>()
        this.logger.log(`[OUT] ${method} ${path} status=${response.statusCode} output=${formatForLog(output, false)}`)
      }),
    )
  }
}

const SENSITIVE_FIELD = /(^|_|-)(authorization|token|secret|password|sessionkey|encrypteddata|iv)($|_|-)/i
const MAX_LOG_STRING_LENGTH = 500

function formatForLog(value: unknown, redactCode: boolean): string {
  try {
    return JSON.stringify(sanitizeForLog(value, undefined, redactCode))
  } catch {
    return '[unserializable]'
  }
}

function sanitizeForLog(value: unknown, fieldName?: string, redactCode = true): unknown {
  if (fieldName && (SENSITIVE_FIELD.test(fieldName) || (redactCode && fieldName === 'code'))) return '[REDACTED]'
  if (typeof value === 'string') {
    return value.length > MAX_LOG_STRING_LENGTH
      ? `${value.slice(0, MAX_LOG_STRING_LENGTH)}...[truncated]`
      : value
  }
  if (typeof value === 'bigint') return Number(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item, undefined, redactCode))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeForLog(item, key, redactCode)]),
    )
  }
  return value
}
