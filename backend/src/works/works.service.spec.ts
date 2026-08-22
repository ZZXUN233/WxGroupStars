import { NotFoundException } from '@nestjs/common'
import { WorksService } from './works.service'

const authorRow = { id: 1n, nickname: 'zzx', avatarUrl: null }
const makeWork = (over: Record<string, any> = {}) => ({
  id: 10n, authorId: 1n, title: '测试作品', type: 'text', textContent: '# 标题',
  mediaUrl: null, techCode: null, externalLink: null, coverUrl: null,
  tags: null, reviewStatus: 'pass', isActive: true, isDraft: false,
  createdAt: new Date('2026-08-01T00:00:00Z'), updatedAt: new Date('2026-08-01T00:00:00Z'),
  author: authorRow,
  projections: [],
  ...over,
})

/** 可注入各表方法的 prisma mock */
const makePrisma = (overrides: Record<string, any> = {}) =>
  ({
    work: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    member: { findUnique: jest.fn() },
    user: { findUniqueOrThrow: jest.fn() },
    projection: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn({})),
    ...overrides,
  }) as any

describe('WorksService（草稿：Work.isDraft，ADR-0009 扩展）', () => {
  describe('publish', () => {
    it('draft=true 只建草稿：不校验群、不创建投影', async () => {
      const prisma = makePrisma()
      prisma.work.create.mockResolvedValue(makeWork({ id: 100n, isDraft: true }))
      prisma.user.findUniqueOrThrow.mockResolvedValue(authorRow)
      const svc = new WorksService(prisma)

      const dto = await svc.publish(1, { title: '草稿', type: 'text', draft: true })

      expect(prisma.work.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isDraft: true }) })
      expect(prisma.member.findUnique).not.toHaveBeenCalled()
      expect(prisma.projection.create).not.toHaveBeenCalled()
      expect(dto.isDraft).toBe(true)
    })

    it('draft 缺省且无 spaceIds → 创建无投影的已发布作品', async () => {
      const prisma = makePrisma()
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma))
      prisma.work.create.mockResolvedValue(makeWork({ isDraft: false }))
      prisma.user.findUniqueOrThrow.mockResolvedValue(authorRow)
      const svc = new WorksService(prisma)

      const dto = await svc.publish(1, { title: 'x', type: 'text' })

      expect(prisma.work.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ isDraft: expect.anything() }) })
      expect(prisma.projection.create).not.toHaveBeenCalled()
      expect(dto.isDraft).toBe(false)
    })
  })

  describe('getMyDrafts', () => {
    it('只查 authorId + isDraft + isActive，按 updatedAt 倒序', async () => {
      const prisma = makePrisma()
      prisma.work.findMany.mockResolvedValue([makeWork({ id: 1n, isDraft: true })])
      const svc = new WorksService(prisma)

      const list = await svc.getMyDrafts(1)

      expect(prisma.work.findMany).toHaveBeenCalledWith({
        where: { authorId: 1, isActive: true, isDraft: true },
        orderBy: { updatedAt: 'desc' },
        include: { author: true },
      })
      expect(list).toHaveLength(1)
      expect(list[0].isDraft).toBe(true)
    })
  })

  describe('edit（草稿 → 发布）', () => {
    it('草稿传 draft=false 且 spaceIds → 更新 isDraft=false 并投影', async () => {
      const prisma = makePrisma()
      prisma.work.findUnique.mockResolvedValue(makeWork({ isDraft: true }))
      prisma.member.findUnique.mockResolvedValue({ id: 1n, role: 'member', isActive: true }) // requireMember 通过
      prisma.work.update.mockResolvedValue(makeWork({ isDraft: false }))
      prisma.projection.findUnique.mockResolvedValue(null)
      prisma.projection.create.mockResolvedValue({ id: 1n })
      const svc = new WorksService(prisma)

      const dto = await svc.edit(1, 10, { title: 'x', type: 'text', draft: false, spaceIds: [5] })

      expect(prisma.work.update).toHaveBeenCalledWith({ where: { id: 10 }, data: expect.objectContaining({ isDraft: false }), include: { author: true } })
      expect(prisma.projection.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workId: 10, spaceId: 5 }) })
      expect(dto.isDraft).toBe(false)
    })

    it('草稿转发布但未选群 → 变为已发布作品，不创建投影', async () => {
      const prisma = makePrisma()
      prisma.work.findUnique.mockResolvedValue(makeWork({ isDraft: true }))
      prisma.work.update.mockResolvedValue(makeWork({ isDraft: false }))
      const svc = new WorksService(prisma)

      const dto = await svc.edit(1, 10, { title: 'x', type: 'text', draft: false })

      expect(prisma.work.update).toHaveBeenCalledWith({ where: { id: 10 }, data: expect.objectContaining({ isDraft: false }), include: { author: true } })
      expect(prisma.projection.create).not.toHaveBeenCalled()
      expect(dto.isDraft).toBe(false)
    })

    it('编辑已发布作品 draft 缺省 → 不创建投影', async () => {
      const prisma = makePrisma()
      prisma.work.findUnique.mockResolvedValue(makeWork({ isDraft: false }))
      prisma.work.update.mockResolvedValue(makeWork({ isDraft: false }))
      const svc = new WorksService(prisma)

      await svc.edit(1, 10, { title: '新标题', type: 'text' })

      expect(prisma.projection.create).not.toHaveBeenCalled()
      expect(prisma.member.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('getDetail（草稿可见性）', () => {
    it('非作者访问草稿 → NotFound（对外表现为不存在）', async () => {
      const prisma = makePrisma()
      prisma.work.findUnique.mockResolvedValue(makeWork({ authorId: 1n, isDraft: true }))
      const svc = new WorksService(prisma)

      await expect(svc.getDetail(99, 10)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('作者本人可读取自己的草稿', async () => {
      const prisma = makePrisma()
      prisma.work.findUnique.mockResolvedValue(makeWork({ authorId: 1n, isDraft: true }))
      const svc = new WorksService(prisma)

      const dto = await svc.getDetail(1, 10)
      expect(dto.isDraft).toBe(true)
    })
  })
})
