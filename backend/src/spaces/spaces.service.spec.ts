import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { SpacesService } from './spaces.service'

describe('SpacesService', () => {
  const owner = { id: 1n, spaceId: 1n, userId: 1n, role: 'owner', isActive: true }
  const memberRow = { id: 2n, spaceId: 1n, userId: 2n, role: 'member', isActive: true }

  /** 可注入各表 findUnique 结果的 prisma mock */
  const makePrisma = (overrides: Record<string, any> = {}) =>
    ({
      member: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      space: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      spaceInvite: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      projection: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      like: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(overrides.tx ?? {})),
      ...overrides,
    }) as any

  describe('create', () => {
    it('事务内建空间 + owner 成员，返回 owner DTO', async () => {
      const tx = {
        space: { create: jest.fn().mockResolvedValue({ id: 9n, name: '新群', creatorId: 1n, coverUrl: null, createdAt: new Date() }) },
        member: { create: jest.fn().mockResolvedValue({}) },
      }
      const prisma = makePrisma({ tx })
      const svc = new SpacesService(prisma)

      const dto = await svc.create(1, { name: '新群' })

      expect(tx.space.create).toHaveBeenCalledWith({
        data: { name: '新群', creatorId: 1, coverUrl: null },
      })
      expect(tx.member.create).toHaveBeenCalledWith({
        data: { spaceId: 9n, userId: 1, role: 'owner' },
      })
      expect(dto).toMatchObject({ id: 9, name: '新群', myRole: 'owner', memberCount: 1, workCount: 0 })
    })
  })

  describe('join（ADR-0008 群上下文门禁）', () => {
    it('空间已绑定 openGid 且不匹配 → 创建待审核申请', async () => {
      const prisma = makePrisma()
      prisma.space.findUnique.mockResolvedValue({ id: 1n, isActive: true, openGid: 'group-A' })
      const svc = new SpacesService(prisma)

      prisma.member.findUnique.mockResolvedValue(null)
      prisma.member.create.mockResolvedValue({})

      await expect(svc.join(2, 1, 'group-B')).resolves.toMatchObject({ state: 'pending', space: null })
      expect(prisma.member.create).toHaveBeenCalledWith({ data: { spaceId: 1, userId: 2, role: 'member', status: 'pending' } })
    })

    it('openGid 命中 / 未绑定 → 正常加入', async () => {
      const prisma = makePrisma()
      prisma.space.findUnique.mockResolvedValue({
        id: 1n, name: '群A', creatorId: 1n, coverUrl: null, isActive: true, openGid: 'group-A', createdAt: new Date(),
      })
      // 加入时的 existing 检查 → null（触发创建）；随后 getDetail 内 requireMember → 成员
      prisma.member.findUnique.mockResolvedValueOnce(null).mockResolvedValue(memberRow)
      prisma.member.create.mockResolvedValue({})
      prisma.member.count.mockResolvedValue(1)
      prisma.projection.count.mockResolvedValue(0)
      const svc = new SpacesService(prisma)

      const dto = await svc.join(2, 1, 'group-A')
      expect(prisma.member.create).toHaveBeenCalled()
      expect(dto.state).toBe('active')
      expect(dto.space?.memberCount).toBe(1)
    })

    it('未绑定 openGid 的空间首次群内打开 → 绑定并加入（一群一空间）', async () => {
      const prisma = makePrisma()
      prisma.space.findUnique.mockResolvedValue({
        id: 1n, name: '群A', creatorId: 1n, coverUrl: null, isActive: true, openGid: null, createdAt: new Date(),
      })
      prisma.space.update.mockResolvedValue({})
      prisma.member.findUnique.mockResolvedValueOnce(null).mockResolvedValue(memberRow)
      prisma.member.create.mockResolvedValue({})
      prisma.member.count.mockResolvedValue(1)
      prisma.projection.count.mockResolvedValue(0)
      const svc = new SpacesService(prisma)

      await svc.join(2, 1, 'group-A')
      expect(prisma.space.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { openGid: 'group-A' } })
      expect(prisma.member.create).toHaveBeenCalled()
    })

    it('没有 openGid → 创建待审核申请，不会直接进入空间', async () => {
      const prisma = makePrisma()
      prisma.space.findUnique.mockResolvedValue({ id: 1n, isActive: true, openGid: 'group-A' })
      prisma.member.findUnique.mockResolvedValue(null)
      prisma.member.create.mockResolvedValue({})
      const svc = new SpacesService(prisma)

      await expect(svc.join(2, 1)).resolves.toEqual({ state: 'pending', space: null })
      expect(prisma.member.create).toHaveBeenCalledWith({ data: { spaceId: 1, userId: 2, role: 'member', status: 'pending' } })
    })

    it('已有待审核申请重复进入 → 不重复创建申请', async () => {
      const prisma = makePrisma()
      prisma.space.findUnique.mockResolvedValue({ id: 1n, isActive: true, openGid: 'group-A' })
      prisma.member.findUnique.mockResolvedValue({ id: 3n, status: 'pending', isActive: true })
      const svc = new SpacesService(prisma)

      await expect(svc.join(2, 1)).resolves.toEqual({ state: 'pending', space: null })
      expect(prisma.member.create).not.toHaveBeenCalled()
      expect(prisma.member.update).not.toHaveBeenCalled()
    })
  })

  describe('成员申请审核', () => {
    it('owner 可查看并通过待审核申请', async () => {
      const prisma = makePrisma()
      const applicant = { id: 3n, spaceId: 1n, userId: 2n, role: 'member', status: 'pending', isActive: true, joinedAt: new Date() }
      const user = { id: 2n, nickname: '申请人', avatarUrl: null }
      prisma.member.findUnique.mockResolvedValue(owner)
      prisma.member.findFirst.mockResolvedValue({ ...applicant, user })
      prisma.member.findMany.mockResolvedValue([{ ...applicant, user }])
      prisma.member.update.mockResolvedValue({ ...applicant, status: 'active', user })
      const svc = new SpacesService(prisma)

      await expect(svc.getPendingMembers(1, 1)).resolves.toHaveLength(1)
      await expect(svc.reviewMember(1, 1, 3, true)).resolves.toMatchObject({ id: 3, status: 'active' })
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 3 }, data: { status: 'active' }, include: { user: true },
      })
    })

    it('普通成员不能审核申请', async () => {
      const prisma = makePrisma()
      prisma.member.findUnique.mockResolvedValue(memberRow)
      const svc = new SpacesService(prisma)

      await expect(svc.getPendingMembers(2, 1)).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.member.findMany).not.toHaveBeenCalled()
    })
  })

  describe('临时成员邀请', () => {
    it('active 成员可创建 24 小时邀请', async () => {
      const prisma = makePrisma()
      const createdAt = new Date()
      const expiresAt = new Date(createdAt.getTime() + 86400000)
      prisma.space.findUnique.mockResolvedValue({ id: 1n, name: '群A', isActive: true })
      prisma.member.findUnique.mockResolvedValue(memberRow)
      prisma.spaceInvite.create.mockImplementation(async ({ data }: any) => ({ ...data, expiresAt }))
      const svc = new SpacesService(prisma)

      const result = await svc.createInvite(2, 1)
      expect(result).toMatchObject({ space: { id: 1, name: '群A' }, expiresAt: expiresAt.toISOString() })
      expect(result.token).toHaveLength(48)
    })

    it('有效邀请只能接受一次，接受后直接成为正式成员', async () => {
      const prisma = makePrisma()
      const invite = { id: 7n, spaceId: 1n, token: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60000), usedAt: null, space: { id: 1n, name: '群A', isActive: true } }
      const tx = {
        spaceInvite: { update: jest.fn() },
        member: { create: jest.fn() },
      }
      prisma.spaceInvite.findUnique.mockResolvedValue(invite)
      prisma.member.findUnique.mockResolvedValue(null)
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(tx))
      prisma.member.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(memberRow)
      prisma.space.findUnique.mockResolvedValue({ id: 1n, name: '群A', creatorId: 1n, isActive: true, createdAt: new Date(), coverUrl: null })
      prisma.member.count.mockResolvedValue(1)
      prisma.projection.count.mockResolvedValue(0)
      const svc = new SpacesService(prisma)

      await expect(svc.acceptInvite(2, invite.token)).resolves.toMatchObject({ state: 'active' })
      expect(tx.spaceInvite.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { usedAt: expect.any(Date) } })
      expect(tx.member.create).toHaveBeenCalledWith({ data: { spaceId: 1n, userId: 2, role: 'member', status: 'active' } })
    })

    it('过期邀请被拒绝', async () => {
      const prisma = makePrisma()
      prisma.spaceInvite.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() - 1000), usedAt: null, space: { isActive: true } })
      const svc = new SpacesService(prisma)

      await expect(svc.acceptInvite(2, 'expired')).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('getDetail（ADR-0006 封闭性）', () => {
    it('非成员 → Forbidden', async () => {
      const prisma = makePrisma()
      prisma.space.findUnique.mockResolvedValue({ id: 1n, isActive: true })
      prisma.member.findUnique.mockResolvedValue(null)
      const svc = new SpacesService(prisma)

      await expect(svc.getDetail(99, 1)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('成员 → SpaceDto（含计数）', async () => {
      const prisma = makePrisma()
      prisma.space.findUnique.mockResolvedValue({ id: 1n, name: '群A', creatorId: 1n, coverUrl: null, isActive: true, createdAt: new Date() })
      prisma.member.findUnique.mockResolvedValue(memberRow)
      prisma.member.count.mockResolvedValue(2)
      prisma.projection.count.mockResolvedValue(3)
      const svc = new SpacesService(prisma)

      const dto = await svc.getDetail(2, 1)
      expect(dto).toMatchObject({ id: 1, memberCount: 2, workCount: 3, myRole: 'member' })
    })
  })

  describe('transferOwner', () => {
    it('目标不在群内 → BadRequest', async () => {
      const prisma = makePrisma()
      prisma.member.findUnique.mockResolvedValueOnce(owner).mockResolvedValueOnce(null)
      const svc = new SpacesService(prisma)

      await expect(svc.transferOwner(1, 1, 999)).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('治理权限', () => {
    it('非 owner 更新空间 → Forbidden', async () => {
      const prisma = makePrisma()
      prisma.member.findUnique.mockResolvedValue(memberRow)
      const svc = new SpacesService(prisma)

      await expect(svc.update(2, 1, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenException)
    })
  })
})
