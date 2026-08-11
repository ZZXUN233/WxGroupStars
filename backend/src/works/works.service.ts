import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { likedProjectionIds } from '../common/likes'
import { mediaUrlOf, projectionToDto, workToDto } from '../common/mappers'
import { requireMember } from '../common/membership'
import type { ProjectionDto, UpsertWorkInput, WorkDto } from '../types/api'

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  /** 作品必须存在且作者本人（ADR-0009 作者可编辑/软删） */
  private async requireAuthor(userId: number, workId: number) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } })
    if (!work || !work.isActive) throw new NotFoundException('作品不存在')
    if (Number(work.authorId) !== userId) throw new ForbiddenException('仅作者可操作')
    return work
  }

  async getDetail(userId: number, workId: number): Promise<WorkDto> {
    const work = await this.prisma.work.findUnique({ where: { id: workId }, include: { author: true } })
    if (!work || !work.isActive) throw new NotFoundException('作品不存在')
    // 草稿仅作者本人可见，对外表现为不存在（ADR-0009 草稿语义）
    if (work.isDraft && Number(work.authorId) !== userId) throw new NotFoundException('作品不存在')
    return workToDto(work)
  }

  /** 当前用户的草稿列表（最新在前），供「我的草稿」入口 */
  async getMyDrafts(userId: number): Promise<WorkDto[]> {
    const works = await this.prisma.work.findMany({
      where: { authorId: userId, isActive: true, isDraft: true },
      orderBy: { updatedAt: 'desc' },
      include: { author: true },
    })
    return works.map(workToDto)
  }

  /** 发布作品：创建 work + 投影到所选群（ADR-0002 / 0006）；draft=true 时仅存草稿不投影 */
  async publish(userId: number, input: UpsertWorkInput): Promise<WorkDto> {
    if (input.draft) {
      const created = await this.prisma.work.create({
        data: {
          authorId: userId,
          title: input.title,
          type: input.type,
          textContent: input.textContent ?? null,
          mediaUrl: mediaUrlOf(input.type, input.mediaKeys),
          coverUrl: input.coverKey ?? null,
          externalLink: input.externalLink ?? null,
          techCode: input.techCode ?? null,
          tags: input.tags?.length ? input.tags : Prisma.DbNull,
          isDraft: true,
        },
      })
      const author = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
      return workToDto({ ...created, author })
    }

    const spaceIds = [...new Set(input.spaceIds ?? [])]
    if (!spaceIds.length) throw new BadRequestException('至少选择一个群空间')
    for (const sid of spaceIds) await requireMember(this.prisma, userId, sid)

    const created = await this.prisma.$transaction(async (tx) => {
      const work = await tx.work.create({
        data: {
          authorId: userId,
          title: input.title,
          type: input.type,
          textContent: input.textContent ?? null,
          mediaUrl: mediaUrlOf(input.type, input.mediaKeys),
          coverUrl: input.coverKey ?? null,
          externalLink: input.externalLink ?? null,
          techCode: input.techCode ?? null,
          tags: input.tags?.length ? input.tags : Prisma.DbNull,
          reviewStatus: 'pass', // MVP 乐观展示（ADR-0014：图片异步审核回调再收敛）
        },
      })
      for (const sid of spaceIds) {
        await tx.projection.create({ data: { workId: work.id, spaceId: sid, authorId: userId } })
      }
      return work
    })

    const author = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return workToDto({ ...created, author })
  }

  /** 编辑作品本体：所有投影即时生效（ADR-0009）；草稿可在此转发布 */
  async edit(userId: number, workId: number, input: UpsertWorkInput): Promise<WorkDto> {
    const prev = await this.requireAuthor(userId, workId)
    const type = input.type ?? prev.type
    const work = await this.prisma.work.update({
      where: { id: workId },
      data: {
        title: input.title ?? undefined,
        type: input.type ?? undefined,
        textContent: input.textContent === undefined ? undefined : input.textContent,
        mediaUrl: input.mediaKeys ? mediaUrlOf(type, input.mediaKeys) : undefined,
        coverUrl: input.coverKey === undefined ? undefined : input.coverKey,
        externalLink: input.externalLink === undefined ? undefined : input.externalLink,
        techCode: input.techCode === undefined ? undefined : input.techCode,
        tags: input.tags === undefined ? undefined : input.tags.length ? input.tags : Prisma.DbNull,
        // 草稿 → 发布：draft 显式传 false 才切换；编辑中保持 draft 不变
        isDraft: input.draft === undefined ? undefined : input.draft,
      },
      include: { author: true },
    })

    // 草稿转发布：校验群并投影（与 publish 同语义，已有投影则复活）
    if (prev.isDraft && input.draft === false) {
      const spaceIds = [...new Set(input.spaceIds ?? [])]
      if (!spaceIds.length) throw new BadRequestException('至少选择一个群空间')
      for (const sid of spaceIds) await requireMember(this.prisma, userId, sid)
      for (const sid of spaceIds) {
        const existing = await this.prisma.projection.findUnique({
          where: { uk_work_space: { workId, spaceId: sid } },
        })
        if (existing) {
          await this.prisma.projection.update({ where: { id: existing.id }, data: { isActive: true } })
        } else {
          await this.prisma.projection.create({ data: { workId, spaceId: sid, authorId: userId } })
        }
      }
    }

    return workToDto(work)
  }

  /** 软删作品：隐藏全部投影与互动（ADR-0009），不物理删除 */
  async remove(userId: number, workId: number): Promise<null> {
    await this.requireAuthor(userId, workId)
    await this.prisma.work.update({ where: { id: workId }, data: { isActive: false } })
    return null
  }

  /**
   * 追加投影（ADR-0002）：仅作者本人；目标群已存在投影时"复活"（is_active=true，
   * 时间戳不变，防刷顶），否则新建。
   */
  async appendProjection(userId: number, workId: number, spaceId: number): Promise<ProjectionDto> {
    await this.requireAuthor(userId, workId)
    await requireMember(this.prisma, userId, spaceId)

    const existing = await this.prisma.projection.findUnique({
      where: { uk_work_space: { workId, spaceId } },
    })
    if (existing) {
      await this.prisma.projection.update({ where: { id: existing.id }, data: { isActive: true } })
    } else {
      await this.prisma.projection.create({ data: { workId, spaceId, authorId: userId } })
    }

    const full = await this.prisma.projection.findUniqueOrThrow({
      where: { uk_work_space: { workId, spaceId } },
      include: { work: { include: { author: true } } },
    })
    const liked = await likedProjectionIds(this.prisma, [full.id], userId)
    return projectionToDto(full, liked.has(Number(full.id)))
  }
}
