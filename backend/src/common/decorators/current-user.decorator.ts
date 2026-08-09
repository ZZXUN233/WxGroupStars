import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/** 当前登录用户（AuthGuard 注入），字段对齐 UserDto.id；sessionKey 用于 shareTicket 解密（ADR-0008） */
export interface AuthUser {
  id: number
  sessionKey: string
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user
})
