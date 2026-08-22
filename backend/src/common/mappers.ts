import type { Comment, Member, Projection, Space, User, Work } from '@prisma/client'
import type {
  CommentDto, MemberDto, MemberRole, MemberStatus, ProjectionDto, SpaceDto, TimelineSlice, UserDto, WorkDto, WorkType,
} from '../types/api'

/* ---------- 基础映射 ---------- */

/** 空昵称兜底：dev 登录或未填微信资料的用户 nickname 为 null，给个可展示的占位名 */
export function userToDto(u: Pick<User, 'id' | 'nickname' | 'avatarUrl'>): UserDto {
  return {
    id: Number(u.id),
    nickname: u.nickname ?? `星友${Number(u.id)}`,
    avatarUrl: u.avatarUrl,
  }
}

/** work.media_url：图片存 JSON 数组串，音视频存单 key（ADR-0005） */
function mediaUrlsOf(type: WorkType, raw: string | null): string[] {
  if (!raw) return []
  if (type === 'image') {
    try {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.map(String) : []
    } catch {
      return []
    }
  }
  return [raw]
}

/** 存储侧编码：图片 → JSON 数组串，其余 → 单 key（与 mediaUrlsOf 互逆） */
export function mediaUrlOf(type: WorkType, keys?: string[] | null): string | null {
  if (!keys || !keys.length) return null
  return type === 'image' ? JSON.stringify(keys) : keys[0]
}

/** COS key → 完整访问 URL（ADR-0005）。历史数据/未配置 COS 时可能已是完整 URL 或 mock 路径，原样返回。 */
function toCosUrl(key: string | null): string | null {
  if (!key) return null
  if (/^https?:\/\//.test(key)) return key
  const base = process.env.COS_BASE_URL
  if (!base) return key
  return `${base.replace(/\/+$/, '')}/${key}`
}

/* ---------- 作品 ---------- */

export function workToDto(w: Work & { author: User }): WorkDto {
  return {
    id: Number(w.id),
    title: w.title,
    author: userToDto(w.author),
    type: w.type as WorkType,
    textContent: w.textContent,
    mediaUrls: mediaUrlsOf(w.type as WorkType, w.mediaUrl)
      .map((k) => toCosUrl(k))
      .filter((x): x is string => !!x),
    coverUrl: toCosUrl(w.coverUrl),
    tags: Array.isArray(w.tags) ? (w.tags as string[]) : [],
    externalLink: w.externalLink,
    techCode: w.techCode,
    reviewStatus: w.reviewStatus as WorkDto['reviewStatus'],
    isDraft: w.isDraft,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }
}

/* ---------- 投影 ---------- */

export function projectionToDto(
  p: Projection & { work: Work & { author: User } },
  likedByMe: boolean,
): ProjectionDto {
  return {
    id: Number(p.id),
    spaceId: Number(p.spaceId),
    work: workToDto(p.work),
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    collectCount: p.collectCount,
    projectedAt: p.createdAt.toISOString(),
    likedByMe,
  }
}

/* ---------- 群空间 ---------- */

export function spaceToDto(
  s: Pick<Space, 'id' | 'name' | 'creatorId' | 'coverUrl' | 'createdAt'>,
  opts: { myRole: MemberRole | null; memberCount: number; workCount: number; pendingCount?: number },
): SpaceDto {
  return {
    id: Number(s.id),
    name: s.name,
    coverUrl: s.coverUrl,
    creatorId: Number(s.creatorId),
    memberCount: opts.memberCount,
    workCount: opts.workCount,
    pendingCount: opts.pendingCount ?? 0,
    myRole: opts.myRole ?? 'member',
    createdAt: s.createdAt.toISOString(),
  }
}

export function memberToDto(m: Member & { user: User }): MemberDto {
  return {
    id: Number(m.id),
    user: userToDto(m.user),
    role: m.role as MemberRole,
    status: m.status as MemberStatus,
    joinedAt: m.joinedAt.toISOString(),
  }
}

/* ---------- 评论 ---------- */

type CommentWithRel = Comment & {
  user: User
  replyToUser: User | null
  replies?: CommentWithRel[]
}

export function commentToDto(c: CommentWithRel, viewerId: number): CommentDto {
  return {
    id: Number(c.id),
    user: userToDto(c.user),
    content: c.content,
    replyToUser: c.replyToUser ? userToDto(c.replyToUser) : null,
    replies: (c.replies ?? []).map((r) => commentToDto(r, viewerId)),
    createdAt: c.createdAt.toISOString(),
    isMine: Number(c.userId) === viewerId,
  }
}

/* ---------- 时间轴切片（ADR-0002 日历口径） ---------- */

export function inSlice(iso: string, slice: TimelineSlice): boolean {
  const d = new Date(iso)
  const now = new Date()
  const startOfWeek = (x: Date) => {
    const day = (x.getDay() + 6) % 7
    const s = new Date(x)
    s.setDate(s.getDate() - day)
    s.setHours(0, 0, 0, 0)
    return s
  }
  switch (slice) {
    case 'today':
      return d.toDateString() === now.toDateString()
    case 'week':
      return d >= startOfWeek(now) && d < new Date(startOfWeek(now).getTime() + 7 * 864e5)
    case 'month':
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    case 'year':
      return d.getFullYear() === now.getFullYear()
    default:
      return true
  }
}

export function paginate<T>(items: T[], page: number, size = 10) {
  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    hasMore: items.length > page * size,
  }
}
