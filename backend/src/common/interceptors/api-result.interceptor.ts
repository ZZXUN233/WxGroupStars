import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable, map } from 'rxjs'

/**
 * 统一成功响应包裹：controller 返回的 data → { code: 0, message: 'ok', data }。
 * 错误响应由 AllExceptionsFilter 处理。
 */
@Injectable()
export class ApiResultInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => ({ code: 0, message: 'ok', data: data ?? null })))
  }
}
