import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { likedProjectionIds } from '../common/likes'
import { inSlice, memberToDto, paginate, projectionToDto, spaceToDto } from '../common/mappers'
import type { CreateSpaceInput, JoinResultDto, MemberDto, MemberRole, ProjectionDto, SpaceDto, SpaceInviteDto, TimelineSlice } from '../types/api'

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------- 成员资格（ADR-0006 封闭性） ---------- */

  private async requireMember(userId: number, spaceId: number) {
    const member = await this.prisma.member.findUnique({
      where: { uk_space_user: { spaceId, userId } },
    })
    if (!member || !member.isActive || (member.status && member.status !== 'active')) throw new ForbiddenException('你不是该群空间的成员')
    return member
  }

  private async requireOwner(userId: number, spaceId: number) {
    const member = await this.requireMember(userId, spaceId)
    if (member.role !== 'owner') throw new ForbiddenException('仅群空间发起人可操作')
    return member
  }

  private async requireActiveSpace(spaceId: number) {
    const space = await this.prisma.space.findUnique({ where: { id: spaceId } })
    if (!space || !space.isActive) throw new NotFoundException('群空间不存在')
    return space
  }

  /* ---------- 查询 ---------- */

  async getMine(userId: number): Promise<SpaceDto[]> {
    const members = await this.prisma.member.findMany({
      where: { userId, isActive: true },
      include: {
        space: {
          include: {
            members: { where: { isActive: true, status: 'active' } },
            projections: { where: { isActive: true }, select: { id: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })
    return members.map((m) =>
      spaceToDto(m.space, {
        myRole: m.role as MemberRole,
        memberCount: m.space.members.length,
        workCount: m.space.projections.length,
      }),
    )
  }

  async getDetail(userId: number, spaceId: number): Promise<SpaceDto> {
    const space = await this.requireActiveSpace(spaceId)
    const me = await this.requireMember(userId, spaceId)
    const [memberCount, workCount] = await Promise.all([
      this.prisma.member.count({ where: { spaceId, isActive: true, status: 'active' } }),
      this.prisma.projection.count({ where: { spaceId, isActive: true } }),
    ])
    return spaceToDto(space, { myRole: me.role as MemberRole, memberCount, workCount })
  }

  async getMembers(userId: number, spaceId: number): Promise<MemberDto[]> {
    await this.requireMember(userId, spaceId)
    const members = await this.prisma.member.findMany({
      where: { spaceId, isActive: true, status: 'active' },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    })
    return members.map(memberToDto)
  }

  async getPendingMembers(userId: number, spaceId: number): Promise<MemberDto[]> {
    const manager = await this.requireMember(userId, spaceId)
    if (manager.role !== 'owner' && manager.role !== 'admin') throw new ForbiddenException('仅群主或管理员可审核申请')
    const members = await this.prisma.member.findMany({
      where: { spaceId, status: 'pending', isActive: true },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    })
    return members.map(memberToDto)
  }

  private async requireManager(userId: number, spaceId: number) {
    const manager = await this.requireMember(userId, spaceId)
    if (manager.role !== 'owner' && manager.role !== 'admin') throw new ForbiddenException('仅群主或管理员可审核申请')
    return manager
  }

  async reviewMember(userId: number, spaceId: number, memberId: number, approved: boolean): Promise<MemberDto> {
    await this.requireManager(userId, spaceId)
    const target = await this.prisma.member.findFirst({
      where: { id: memberId, spaceId, status: 'pending', isActive: true },
      include: { user: true },
    })
    if (!target) throw new BadRequestException('申请不存在或已处理')
    const member = await this.prisma.member.update({
      where: { id: memberId },
      data: approved ? { status: 'active' } : { status: 'rejected' },
      include: { user: true },
    })
    return memberToDto(member)
  }

  /* ---------- 创建 / 治理 ---------- */

  async create(userId: number, input: CreateSpaceInput): Promise<SpaceDto> {
    return this.prisma.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: { name: input.name, creatorId: userId, coverUrl: input.coverUrl ?? null },
      })
      await tx.member.create({ data: { spaceId: space.id, userId, role: 'owner' } })
      return spaceToDto(space, { myRole: 'owner', memberCount: 1, workCount: 0 })
    })
  }

  async update(userId: number, spaceId: number, input: { name?: string; coverUrl?: string | null }): Promise<SpaceDto> {
    await this.requireOwner(userId, spaceId)
    const space = await this.prisma.space.update({
      where: { id: spaceId },
      data: {
        name: input.name ?? undefined,
        coverUrl: input.coverUrl === undefined ? undefined : input.coverUrl,
      },
    })
    const [memberCount, workCount] = await Promise.all([
      this.prisma.member.count({ where: { spaceId, isActive: true, status: 'active' } }),
      this.prisma.projection.count({ where: { spaceId, isActive: true } }),
    ])
    return spaceToDto(space, { myRole: 'owner', memberCount, workCount })
  }

  async transferOwner(userId: number, spaceId: number, memberId: number): Promise<SpaceDto> {
    const owner = await this.requireOwner(userId, spaceId)
    const target = await this.prisma.member.findUnique({
      where: { uk_space_user: { spaceId, userId: memberId } },
    })
    if (!target || !target.isActive || target.status !== 'active') throw new BadRequestException('目标成员不在群内')

    await this.prisma.$transaction([
      this.prisma.member.update({ where: { id: owner.id }, data: { role: 'member' } }),
      this.prisma.member.update({ where: { id: target.id }, data: { role: 'owner' } }),
      this.prisma.space.update({ where: { id: spaceId }, data: { creatorId: memberId } }),
    ])
    return this.getDetail(userId, spaceId)
  }

  /**
   * 群上下文门禁加入（ADR-0008）：
   * - 空间已绑定 openGid → 需命中才放行；未绑定 → 首次群内打开时绑定。
   * - 无法验证群上下文时创建 pending 申请，不能绕过封闭空间。
   */
  async join(userId: number, spaceId: number, openGid?: string | null): Promise<JoinResultDto> {
    const space = await this.requireActiveSpace(spaceId)
    const verifiedGroup = Boolean(openGid && (!space.openGid || openGid === space.openGid))
    if (verifiedGroup && !space.openGid) {
      await this.prisma.space.update({ where: { id: spaceId }, data: { openGid } })
    }

    const existing = await this.prisma.member.findUnique({
      where: { uk_space_user: { spaceId, userId } },
    })
    if (existing?.status === 'active' && existing.isActive) {
      return { state: 'active', space: await this.getDetail(userId, spaceId) }
    }
    if (verifiedGroup) {
      if (existing) {
        await this.prisma.member.update({ where: { id: existing.id }, data: { status: 'active', isActive: true } })
      } else {
        await this.prisma.member.create({ data: { spaceId, userId, role: 'member', status: 'active' } })
      }
      return { state: 'active', space: await this.getDetail(userId, spaceId) }
    }
    if (existing?.status !== 'pending' || !existing.isActive) {
      await (existing
        ? this.prisma.member.update({ where: { id: existing.id }, data: { status: 'pending', isActive: true } })
        : this.prisma.member.create({ data: { spaceId, userId, role: 'member', status: 'pending' } }))
    }
    return { state: 'pending', space: null }
  }

  async createInvite(userId: number, spaceId: number): Promise<SpaceInviteDto> {
    const space = await this.requireActiveSpace(spaceId)
    await this.requireMember(userId, spaceId)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const invite = await this.prisma.spaceInvite.create({
      data: { spaceId, token: randomBytes(24).toString('hex'), expiresAt },
    })
    return { token: invite.token, expiresAt: invite.expiresAt.toISOString(), space: { id: Number(space.id), name: space.name } }
  }

  async acceptInvite(userId: number, token: string): Promise<JoinResultDto> {
    const invite = await this.prisma.spaceInvite.findUnique({ where: { token }, include: { space: true } })
    if (!invite || invite.usedAt || invite.expiresAt <= new Date() || !invite.space.isActive) {
      throw new BadRequestException('邀请链接已失效')
    }
    const existing = await this.prisma.member.findUnique({ where: { uk_space_user: { spaceId: invite.spaceId, userId } } })
    if (existing?.status === 'active' && existing.isActive) {
      return { state: 'active', space: await this.getDetail(userId, Number(invite.spaceId)) }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.spaceInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } })
      if (existing) {
        await tx.member.update({ where: { id: existing.id }, data: { status: 'active', isActive: true } })
      } else {
        await tx.member.create({ data: { spaceId: invite.spaceId, userId, role: 'member', status: 'active' } })
      }
    })
    return { state: 'active', space: await this.getDetail(userId, Number(invite.spaceId)) }
  }

  /* ---------- 时间轴 / 群内搜索 ---------- */

  async getTimeline(userId: number, spaceId: number, slice: TimelineSlice, page = 1): Promise<{ items: ProjectionDto[]; page: number; hasMore: boolean }> {
    await this.requireMember(userId, spaceId)
    const projections = await this.prisma.projection.findMany({
      where: { spaceId, isActive: true, work: { isActive: true } },
      include: { work: { include: { author: true } } },
    })
    const visible = projections.filter((p) => inSlice(p.createdAt.toISOString(), slice))
    visible.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    const liked = await likedProjectionIds(this.prisma, visible.map((p) => p.id), userId)
    const items = visible.map((p) => projectionToDto(p, liked.has(Number(p.id))))
    return paginate(items, page)
  }

  /** 群内搜索（ADR-0010）：标题 / 正文 / 标签 / 作者昵称 */
  async search(userId: number, spaceId: number, q: string): Promise<ProjectionDto[]> {
    await this.requireMember(userId, spaceId)
    const projections = await this.prisma.projection.findMany({
      where: { spaceId, isActive: true, work: { isActive: true } },
      include: { work: { include: { author: true } } },
    })
    const kw = q.trim().toLowerCase()
    const filtered = kw
      ? projections.filter((p) => {
          const w = p.work
          const tags = Array.isArray(w.tags) ? (w.tags as string[]).join(' ') : ''
          return [w.title, w.textContent || '', tags, w.author.nickname || '']
            .join(' ')
            .toLowerCase()
            .includes(kw)
        })
      : projections
    filtered.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    const liked = await likedProjectionIds(this.prisma, filtered.map((p) => p.id), userId)
    return filtered.map((p) => projectionToDto(p, liked.has(Number(p.id))))
  }
}
