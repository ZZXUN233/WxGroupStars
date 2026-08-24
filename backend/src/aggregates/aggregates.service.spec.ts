import { AggregatesService } from './aggregates.service'

describe('AggregatesService.getFeed（ADR-0006 / ADR-0018 封闭性）', () => {
  /** member 行集合模拟：member.findMany 按 where 中的 status 过滤（模拟真实 DB 语义） */
  const makeMembers = (rows: Array<{ spaceId: bigint; status?: string }>) => ({
    findMany: jest.fn(({ where }: any) =>
      Promise.resolve(
        rows
          .filter((r) => (where.status ? r.status === where.status : true))
          .filter((r) => (where.isActive !== false && where.isActive !== undefined ? true : true))
          .map((r) => ({ spaceId: r.spaceId, status: r.status ?? 'active', isActive: true })),
      ),
    ),
  })

  const makePrisma = (members: { findMany: jest.Mock }) => ({
    member: members,
    projection: { findMany: jest.fn().mockResolvedValue([]) },
    like: { findMany: jest.fn().mockResolvedValue([]) },
    work: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUniqueOrThrow: jest.fn() },
  }) as any

  /** 构造一条属于空间 100 的活跃投影（含 work/author/space） */
  const makeProjection = (projId = 900n, spaceId = 100n, title = '越权作品') => {
    const now = new Date('2026-08-20T00:00:00.000Z')
    return {
      id: projId,
      spaceId,
      createdAt: now,
      updatedAt: now,
      likeCount: 0,
      commentCount: 0,
      collectCount: 0,
      isActive: true,
      workId: 50n,
      authorId: 5n,
      space: { id: spaceId, name: '审批中的群' },
      work: {
        id: 50n,
        title,
        type: 'text',
        textContent: '内容',
        mediaUrl: null,
        coverUrl: null,
        tags: [],
        externalLink: null,
        techCode: null,
        reviewStatus: 'pass',
        isDraft: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        authorId: 5n,
        author: { id: 5n, nickname: '作者', avatarUrl: null },
      },
    }
  }

  it('用户在 pending（审批中）群空间的投影不应出现在首页 feed', async () => {
    // 用户 7 在空间 100 的成员资格为 pending（审批中），非正式成员
    const prisma = makePrisma(makeMembers([{ spaceId: 100n, status: 'pending' }]))
    const svc = new AggregatesService(prisma)

    const feed = await svc.getFeed(7)

    // 修复后查询带 status:'active' 过滤 → DB 侧不返回 pending 的 space，feed 不展示该群投影
    expect(feed.items).toHaveLength(0)
    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: { userId: 7, isActive: true, status: 'active' },
      select: { spaceId: true },
    })
  })

  it('用户在 rejected（被拒）群空间的投影也不应出现在首页 feed', async () => {
    const prisma = makePrisma(makeMembers([{ spaceId: 100n, status: 'rejected' }]))
    const svc = new AggregatesService(prisma)

    const feed = await svc.getFeed(7)

    expect(feed.items).toHaveLength(0)
  })

  it('正式成员（status=active）所在群空间的投影应出现在首页 feed', async () => {
    const prisma = makePrisma(makeMembers([{ spaceId: 100n, status: 'active' }]))
    prisma.projection.findMany.mockResolvedValue([makeProjection()])
    const svc = new AggregatesService(prisma)

    const feed = await svc.getFeed(7)

    expect(feed.items).toHaveLength(1)
    expect(feed.items[0]).toMatchObject({ space: { id: 100 } })
  })
})
