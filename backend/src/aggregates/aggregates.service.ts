import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { likedProjectionIds } from '../common/likes'
import { paginate, projectionToDto, userToDto } from '../common/mappers'
import type { FeedItemDto, PageDto, ProjectionDto, StarTrailDto, WorkType } from '../types/api'

@Injectable()
export class AggregatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 最新星光：查看者已加入群内的活跃投影，按投影时间倒序（ADR-0010） */
  async getFeed(userId: number, page = 1): Promise<PageDto<FeedItemDto>> {
    const mySpaces = await this.prisma.member.findMany({
      where: { userId, isActive: true },
      select: { spaceId: true },
    })
    const projections = await this.prisma.projection.findMany({
      where: { spaceId: { in: mySpaces.map((m) => m.spaceId) }, isActive: true, work: { isActive: true } },
      include: {
        work: { include: { author: true } },
        space: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const liked = await likedProjectionIds(this.prisma, projections.map((p) => p.id), userId)
    const items: FeedItemDto[] = projections.map((p) => ({
      projection: projectionToDto(p, liked.has(Number(p.id))),
      space: { id: Number(p.space.id), name: p.space.name },
    }))
    return paginate(items, page)
  }

  /** 星轨（ADR-0010）：只统计与查看者有共同群的该作者投影；spaceId 提供时以该群为上下文 */
  async getStarTrail(userId: number, targetId: number, spaceId?: number): Promise<StarTrailDto> {
    const [mySpaces, targetMembers] = await Promise.all([
      this.prisma.member.findMany({ where: { userId, isActive: true }, select: { spaceId: true } }),
      this.prisma.member.findMany({ where: { userId: targetId, isActive: true }, select: { spaceId: true } }),
    ])
    const mySpaceIds = new Set(mySpaces.map((m) => Number(m.spaceId)))
    const sharedSpaceIds = targetMembers
      .map((m) => Number(m.spaceId))
      .filter((sid) => mySpaceIds.has(sid))

    const projections: ProjectionDto[] = []
    // 指定了展示群但与该群无共同关系 → 直接空星轨（ADR-0010 上下文口径）
    const scopedToShared = spaceId ? mySpaceIds.has(spaceId) : true
    if ((sharedSpaceIds.length || spaceId) && scopedToShared) {
      const rows = await this.prisma.projection.findMany({
        where: {
          ...(spaceId ? { spaceId } : { spaceId: { in: sharedSpaceIds } }),
          isActive: true,
          work: { isActive: true, authorId: targetId },
        },
        include: { work: { include: { author: true } } },
        orderBy: { createdAt: 'desc' },
      })
      const liked = await likedProjectionIds(this.prisma, rows.map((p) => p.id), userId)
      rows.forEach((p) => projections.push(projectionToDto(p, liked.has(Number(p.id)))))
    }

    const dist: StarTrailDto['typeDistribution'] = {}
    projections.forEach((p) => {
      const t = p.work.type as WorkType
      dist[t] = (dist[t] || 0) + 1
    })
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: targetId } })
    return {
      user: userToDto(target),
      workCount: projections.length,
      typeDistribution: dist,
      recentWorks: projections.slice(0, 10),
    }
  }
}
