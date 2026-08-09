import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../../prisma/prisma.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

/**
 * 会话鉴权（ADR-0004）：Authorization: Bearer <opaque token>
 * 查 session 表换取 user.id；MVP 每请求查表，量级上来再迁缓存。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()
    const header = (req.headers['authorization'] ?? '') as string
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) throw new UnauthorizedException('未登录')

    const session = await this.prisma.session.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) throw new UnauthorizedException('登录已过期')

    req.user = { id: Number(session.userId), sessionKey: session.sessionKey ?? '' }
    return true
  }
}
