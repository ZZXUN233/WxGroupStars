import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { likedProjectionIds } from '../common/likes'
import { paginate, projectionToDto, userToDto, workToDto } from '../common/mappers'
import type { FeedItemDto, PageDto, ProjectionDto, StarTrailDto, StarTrailWorkDto, WorkType } from '../types/api'

@Injectable()
export class AggregatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 最新星光：查看者已加入群内的活跃投影，按投影时间倒序（ADR-0010） */
  async getFeed(userId: number, page = 1): Promise<PageDto<FeedItemDto>> {
    const mySpaces = await this.prisma.member.findMany({
      where: { userId, isActive: true, status: 'active' },
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
      this.prisma.member.findMany({ where: { userId, isActive: true, status: 'active' }, select: { spaceId: true } }),
      this.prisma.member.findMany({ where: { userId: targetId, isActive: true, status: 'active' }, select: { spaceId: true } }),
    ])
    const mySpaceIds = new Set(mySpaces.map((m) => Number(m.spaceId)))
    const sharedSpaceIds = targetMembers
      .map((m) => Number(m.spaceId))
      .filter((sid) => mySpaceIds.has(sid))

    const works: StarTrailWorkDto[] = []
    const seenWorkIds = new Set<number>()

    // 指定了展示群但与该群无共同关系 → 直接空星轨（ADR-0010 上下文口径）
    const scopedToShared = spaceId ? mySpaceIds.has(spaceId) : true
    if ((sharedSpaceIds.length || spaceId) && scopedToShared) {
      // 1. 查询有投影的作品
      const rows = await this.prisma.projection.findMany({
        where: {
          ...(spaceId ? { spaceId } : { spaceId: { in: sharedSpaceIds } }),
          isActive: true,
          work: { isActive: true, authorId: targetId },
        },
        include: { work: { include: { author: true } } },
        orderBy: { createdAt: 'desc' },
      })
      rows.forEach((p) => {
        const workId = Number(p.work.id)
        if (!seenWorkIds.has(workId)) {
          seenWorkIds.add(workId)
          works.push({ ...workToDto(p.work), projectionId: Number(p.id), spaceId: Number(p.spaceId) })
        }
      })
    }

    // 2. 查询未投影的作品（仅查看自己的星轨时显示）
    if (userId === targetId) {
      const unprojectedWorks = await this.prisma.work.findMany({
        where: {
          authorId: targetId,
          isActive: true,
          // 排除已有投影的作品
          id: { notIn: Array.from(seenWorkIds) },
        },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      })
      unprojectedWorks.forEach((w) => {
        const workId = Number(w.id)
        if (!seenWorkIds.has(workId)) {
          seenWorkIds.add(workId)
          // 未投影作品使用 0 作为 projectionId 和 spaceId
          works.push({ ...workToDto(w), projectionId: 0, spaceId: 0 })
        }
      })
    }

    // 3. 统一按创建时间倒序排列
    works.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const dist: StarTrailDto['typeDistribution'] = {}
    works.forEach((work) => {
      const t = work.type as WorkType
      dist[t] = (dist[t] || 0) + 1
    })
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: targetId } })
    return {
      user: userToDto(target),
      workCount: works.length,
      typeDistribution: dist,
      recentWorks: works.slice(0, 10),
    }
  }
}
