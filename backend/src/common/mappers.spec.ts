import { commentToDto, inSlice, mediaUrlOf, paginate, projectionToDto, spaceToDto, userToDto, workToDto } from './mappers'

describe('mappers 纯函数', () => {
  /* ---------- mediaUrlOf（存储侧编码） ---------- */

  it('图片 → JSON 数组串', () => {
    expect(mediaUrlOf('image', ['a.jpg', 'b.jpg'])).toBe(JSON.stringify(['a.jpg', 'b.jpg']))
  })

  it('音视频/其它 → 单 key', () => {
    expect(mediaUrlOf('audio_video', ['m.mp4'])).toBe('m.mp4')
  })

  it('空数组 / 缺省 → null', () => {
    expect(mediaUrlOf('image', [])).toBeNull()
    expect(mediaUrlOf('text', undefined)).toBeNull()
  })

  /* ---------- inSlice（日历口径时间切片，ADR-0002） ---------- */

  it('today：今天 true / 昨天 false', () => {
    const now = new Date()
    expect(inSlice(now.toISOString(), 'today')).toBe(true)
    const yesterday = new Date(now.getTime() - 864e5)
    expect(inSlice(yesterday.toISOString(), 'today')).toBe(false)
  })

  it('year：今年 true / 去年 false', () => {
    const now = new Date()
    expect(inSlice(now.toISOString(), 'year')).toBe(true)
    const lastYear = new Date(now.getFullYear() - 1, 0, 1)
    expect(inSlice(lastYear.toISOString(), 'year')).toBe(false)
  })

  it('week：本周一之前（上周）为 false', () => {
    const now = new Date()
    const dayOffset = (now.getDay() + 6) % 7 // 周一为 0
    const lastWeek = new Date(now)
    lastWeek.setDate(lastWeek.getDate() - dayOffset - 1)
    expect(inSlice(lastWeek.toISOString(), 'week')).toBe(false)
  })

  /* ---------- paginate ---------- */

  it('分页切片与 hasMore', () => {
    const items = [1, 2, 3, 4, 5]
    expect(paginate(items, 1)).toEqual({ items: [1, 2, 3, 4, 5], page: 1, hasMore: false })
    const p2 = paginate([...items, 6, 7, 8], 1, 5)
    expect(p2.hasMore).toBe(true)
    expect(paginate(items, 2, 3)).toEqual({ items: [4, 5], page: 2, hasMore: false })
  })

  /* ---------- DTO 映射 ---------- */

  it('userToDto：BigInt id → number', () => {
    const dto = userToDto({ id: 42n, nickname: '张三', avatarUrl: 'http://a/1.png' })
    expect(dto).toEqual({ id: 42, nickname: '张三', avatarUrl: 'http://a/1.png' })
  })

  it('userToDto：空昵称兜底为 星友<id>（dev 登录用户 nickname 为 null）', () => {
    expect(userToDto({ id: 42n, nickname: null, avatarUrl: null })).toEqual({
      id: 42, nickname: '星友42', avatarUrl: null,
    })
  })

  it('workToDto：图片 mediaUrl JSON 串 → mediaUrls 数组', () => {
    const work: any = {
      id: 7n, title: 'T', author: { id: 1n, nickname: 'A', avatarUrl: null },
      type: 'image', textContent: '正文', mediaUrl: JSON.stringify(['a.jpg', 'b.jpg']),
      coverUrl: null, tags: ['摄影'], externalLink: null, techCode: null,
      reviewStatus: 'pass', createdAt: new Date('2026-08-01T00:00:00Z'), updatedAt: new Date('2026-08-01T00:00:00Z'),
    }
    const dto = workToDto(work)
    expect(dto.mediaUrls).toEqual(['a.jpg', 'b.jpg'])
    expect(dto.type).toBe('image')
    expect(dto.createdAt).toBe('2026-08-01T00:00:00.000Z')
  })

  it('projectionToDto：携带 likedByMe 与独立计数', () => {
    const projection: any = {
      id: 10n, spaceId: 3n,
      work: {
        id: 7n, title: 'T', type: 'text', textContent: null, mediaUrl: null,
        coverUrl: null, tags: null, externalLink: null, techCode: null, reviewStatus: 'pass',
        createdAt: new Date('2026-08-01T00:00:00Z'), updatedAt: new Date('2026-08-01T00:00:00Z'),
        author: { id: 1n, nickname: 'A', avatarUrl: null },
      },
      likeCount: 5, commentCount: 2, collectCount: 0, createdAt: new Date('2026-08-02T00:00:00Z'),
    }
    const dto = projectionToDto(projection, true)
    expect(dto.id).toBe(10)
    expect(dto.spaceId).toBe(3)
    expect(dto.likeCount).toBe(5)
    expect(dto.likedByMe).toBe(true)
    expect(dto.projectedAt).toBe('2026-08-02T00:00:00.000Z')
  })

  it('spaceToDto：myRole / 计数透传', () => {
    const dto = spaceToDto(
      { id: 5n, name: '群A', creatorId: 1n, coverUrl: null, createdAt: new Date('2026-08-03T00:00:00Z') },
      { myRole: 'owner', memberCount: 2, workCount: 3 },
    )
    expect(dto).toMatchObject({ id: 5, name: '群A', creatorId: 1, myRole: 'owner', memberCount: 2, workCount: 3 })
  })

  it('commentToDto：两级回复 + isMine 判断', () => {
    const viewer = 99
    const comment: any = {
      id: 1n, userId: 99n, content: '顶', replyToUser: null,
      createdAt: new Date('2026-08-04T00:00:00Z'),
      user: { id: 99n, nickname: '我', avatarUrl: null },
      replies: [
        { id: 2n, userId: 5n, content: '回复', replyToUser: { id: 99n, nickname: '我', avatarUrl: null }, user: { id: 5n, nickname: '他', avatarUrl: null }, createdAt: new Date('2026-08-04T01:00:00Z') },
      ],
    }
    const dto = commentToDto(comment, viewer)
    expect(dto.isMine).toBe(true)
    expect(dto.replies).toHaveLength(1)
    expect(dto.replies[0].replyToUser?.nickname).toBe('我')
    expect(dto.replies[0].isMine).toBe(false)
  })
})
