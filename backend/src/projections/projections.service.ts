import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { likedProjectionIds } from '../common/likes'
import { projectionToDto } from '../common/mappers'
import { requireMember } from '../common/membership'
import type { ProjectionDto } from '../types/api'

@Injectable()
export class ProjectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async visibleProjection(projectionId: number) {
    const p = await this.prisma.projection.findUnique({
      where: { id: projectionId },
      include: { work: true },
    })
    if (!p || !p.isActive || !p.work.isActive) throw new NotFoundException('作品不存在或已隐藏')
    return p
  }

  async getDetail(userId: number, projectionId: number): Promise<ProjectionDto> {
    const p = await this.visibleProjection(projectionId)
    await requireMember(this.prisma, userId, p.spaceId)

    const full = await this.prisma.projection.findUniqueOrThrow({
      where: { id: projectionId },
      include: { work: { include: { author: true } } },
    })
    const liked = await likedProjectionIds(this.prisma, [full.id], userId)
    return projectionToDto(full, liked.has(Number(full.id)))
  }

  /** 点赞 toggle：唯一约束幂等 + 冗余计数（ADR-0007），取消点赞物理删行 */
  async toggleLike(userId: number, projectionId: number): Promise<{ liked: boolean; likeCount: number }> {
    const p = await this.visibleProjection(projectionId)
    await requireMember(this.prisma, userId, p.spaceId)

    const existing = await this.prisma.like.findUnique({
      where: { uk_proj_user: { projectionId, userId } },
    })
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.like.delete({ where: { id: existing.id } }),
        this.prisma.projection.update({
          where: { id: projectionId },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
      return { liked: false, likeCount: Math.max(0, p.likeCount - 1) }
    }

    await this.prisma.$transaction([
      this.prisma.like.create({ data: { projectionId, userId } }),
      this.prisma.projection.update({
        where: { id: projectionId },
        data: { likeCount: { increment: 1 } },
      }),
    ])
    return { liked: true, likeCount: p.likeCount + 1 }
  }

  /** 撤销投影（ADR-0002）：软删 is_active=0，互动数据保留；重新投影时复活 */
  async revoke(userId: number, projectionId: number): Promise<null> {
    const p = await this.visibleProjection(projectionId)
    const isProjector = Number(p.authorId) === userId
    const isWorkAuthor = Number(p.work.authorId) === userId
    if (!isProjector && !isWorkAuthor) throw new ForbiddenException('仅作者可撤销投影')

    await this.prisma.projection.update({ where: { id: projectionId }, data: { isActive: false } })
    return null
  }
}
