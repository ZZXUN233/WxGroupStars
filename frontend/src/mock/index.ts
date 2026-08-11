/**
 * Mock 服务：与 api 契约一一对应，模拟网络延迟与分页。
 * 切换真实后端时只需替换 src/api/index.ts 的实现。
 */
import type {
  ApiResult, Comment, CreateCommentInput, CreateSpaceInput, Member,
  Page, Projection, Space, StarTrail, TimelineSlice, UpsertWorkInput, User, Work
} from '../types'
import * as DB from './store'
import { ME, SPACES, MEMBERS, SPACE_MEMBERS, WORKS, PROJECTIONS, COMMENTS, PROJECTION_COMMENTS, USERS, ph } from './store'

function ok<T>(data: T): ApiResult<T> {
  return { code: 0, message: 'ok', data }
}

function delay(ms = 300): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/* ---------------- 工具 ---------------- */

function spaceById(id: number): Space {
  const s = SPACES.find((x) => x.id === id)
  if (!s) throw new Error('space not found')
  return s
}

function projectionById(id: number): Projection {
  const p = PROJECTIONS.find((x) => x.id === id)
  if (!p) throw new Error('projection not found')
  return p
}

function membersOf(spaceId: number): Member[] {
  return (SPACE_MEMBERS[spaceId] || []).map((id) => MEMBERS.find((m) => m.id === id)!).filter(Boolean)
}

/** 日历口径时间切片（ADR-0002） */
function inSlice(iso: string, slice: TimelineSlice): boolean {
  const d = new Date(iso)
  const now = new Date()
  const startOfWeek = (x: Date) => {
    const day = (x.getDay() + 6) % 7 // 周一为 0
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
  }
}

function paginate<T>(items: T[], page: number, size = 10): Page<T> {
  return { items: items.slice((page - 1) * size, page * size), page, hasMore: items.length > page * size }
}

function sortedProjections(list: Projection[]) {
  return [...list].sort((a, b) => +new Date(b.projectedAt) - +new Date(a.projectedAt))
}

/* ---------------- 认证 ---------------- */

export async function login(): Promise<ApiResult<{ token: string; user: User }>> {
  await delay()
  return ok({ token: DB.CURRENT_SESSION.token, user: ME })
}

/* ---------------- 群空间 ---------------- */

export async function getMySpaces(): Promise<ApiResult<Space[]>> {
  await delay()
  // 我加入的群空间（SPACE_MEMBERS 含我）
  return ok(SPACES.filter((s) => membersOf(s.id).some((m) => m.user.id === ME.id)))
}

export async function getSpaceDetail(id: number): Promise<ApiResult<Space>> {
  await delay()
  return ok(spaceById(id))
}

export async function getSpaceMembers(id: number): Promise<ApiResult<Member[]>> {
  await delay()
  return ok(membersOf(id))
}

export async function createSpace(input: CreateSpaceInput): Promise<ApiResult<Space>> {
  await delay()
  const space: Space = {
    id: Date.now(), name: input.name, coverUrl: input.coverUrl ?? null, creatorId: ME.id,
    memberCount: 1, workCount: 0, myRole: 'owner', createdAt: new Date().toISOString()
  }
  SPACES.push(space)
  const member = { id: MEMBERS.length + 1, user: ME, role: 'owner' as const, joinedAt: space.createdAt }
  MEMBERS.push(member)
  SPACE_MEMBERS[space.id] = [member.id]
  return ok(space)
}

export async function updateSpace(id: number, input: { name?: string; coverUrl?: string | null }): Promise<ApiResult<Space>> {
  await delay()
  const s = spaceById(id)
  if (input.name) s.name = input.name
  if (input.coverUrl !== undefined) s.coverUrl = input.coverUrl
  return ok(s)
}

export async function transferOwner(spaceId: number, memberId: number): Promise<ApiResult<Space>> {
  await delay()
  const s = spaceById(spaceId)
  const members = membersOf(spaceId)
  const curOwner = members.find((m) => m.role === 'owner')
  const target = members.find((m) => m.id === memberId)
  if (!curOwner || !target) throw new Error('invalid transfer')
  curOwner.role = 'member'
  target.role = 'owner'
  s.creatorId = target.user.id
  return ok(s)
}

/** 群上下文门禁加入（ADR-0008）：mock 直接成功 */
export async function joinSpace(spaceId: number): Promise<ApiResult<Space>> {
  await delay()
  const s = spaceById(spaceId)
  if (!membersOf(spaceId).some((m) => m.user.id === ME.id)) {
    const member = { id: MEMBERS.length + 1, user: ME, role: 'member' as const, joinedAt: new Date().toISOString() }
    MEMBERS.push(member)
    SPACE_MEMBERS[spaceId] = [...(SPACE_MEMBERS[spaceId] || []), member.id]
    s.memberCount += 1
  }
  return ok(s)
}

/* ---------------- 时间轴 / 信息流 ---------------- */

export async function getSpaceTimeline(spaceId: number, slice: TimelineSlice, page = 1): Promise<ApiResult<Page<Projection>>> {
  await delay()
  const list = PROJECTIONS
    .filter((p) => p.spaceId === spaceId && inSlice(p.projectedAt, slice))
    .map((p) => p as Projection)
  return ok(paginate(sortedProjections(list), page))
}

export async function getFeed(page = 1): Promise<ApiResult<Page<{ projection: Projection; space: { id: number; name: string } }>>> {
  await delay()
  const items = sortedProjections(PROJECTIONS as Projection[])
    .filter((p) => membersOf(p.spaceId).some((m) => m.user.id === ME.id)) // 成员资格过滤 ADR-0010
    .map((p) => ({ projection: p, space: { id: p.spaceId, name: spaceById(p.spaceId).name } }))
  return ok(paginate(items, page))
}

export async function searchInSpace(spaceId: number, q: string): Promise<ApiResult<Projection[]>> {
  await delay()
  const kw = q.trim().toLowerCase()
  const list = PROJECTIONS
    .filter((p) => p.spaceId === spaceId)
    .filter((p) => {
      if (!kw) return true
      const w = p.work
      return [w.title, w.textContent || '', w.tags.join(' '), w.author.nickname].join(' ').toLowerCase().includes(kw)
    })
  return ok(sortedProjections(list as Projection[]))
}

/* ---------------- 投影 & 互动 ---------------- */

export async function getProjection(id: number): Promise<ApiResult<Projection>> {
  await delay()
  return ok(projectionById(id))
}

export async function toggleLike(projectionId: number): Promise<ApiResult<{ liked: boolean; likeCount: number }>> {
  await delay(150)
  const p = projectionById(projectionId)
  p.likedByMe = !p.likedByMe
  p.likeCount += p.likedByMe ? 1 : -1
  return ok({ liked: p.likedByMe, likeCount: p.likeCount })
}

export async function getComments(projectionId: number): Promise<ApiResult<Comment[]>> {
  await delay()
  const ids = PROJECTION_COMMENTS[projectionId] || []
  return ok(ids.map((id) => COMMENTS.find((c) => c.id === id)!).filter(Boolean))
}

export async function createComment(projectionId: number, input: CreateCommentInput): Promise<ApiResult<Comment>> {
  await delay(150)
  const p = projectionById(projectionId)
  p.commentCount += 1
  const comment: Comment = {
    id: Date.now(), user: ME, content: input.content,
    replyToUser: input.replyToUserId ? USERS[input.replyToUserId] ? { id: input.replyToUserId, nickname: USERS[input.replyToUserId].nickname, avatarUrl: USERS[input.replyToUserId].avatarUrl ?? null } : null : null,
    replies: [], createdAt: new Date().toISOString(), isMine: true
  }
  if (input.parentId) {
    const parent = COMMENTS.find((c) => c.id === input.parentId)
    if (parent) parent.replies.push(comment)
  } else {
    COMMENTS.push(comment)
    PROJECTION_COMMENTS[projectionId] = [...(PROJECTION_COMMENTS[projectionId] || []), comment.id]
  }
  return ok(comment)
}

export async function deleteComment(commentId: number): Promise<ApiResult<null>> {
  await delay(150)
  const idx = COMMENTS.findIndex((c) => c.id === commentId)
  if (idx >= 0) COMMENTS.splice(idx, 1)
  COMMENTS.forEach((c) => { c.replies = c.replies.filter((r) => r.id !== commentId) })
  return ok(null)
}

/* ---------------- 作品 & 投影管理 ---------------- */

export async function getWork(id: number): Promise<ApiResult<Work>> {
  await delay()
  const w = WORKS.find((x) => x.id === id)
  if (!w) throw new Error('work not found')
  return ok(w)
}

export async function publishWork(input: UpsertWorkInput): Promise<ApiResult<Work>> {
  await delay()
  const work: Work = {
    id: Date.now(), title: input.title, author: ME, type: input.type,
    textContent: input.textContent ?? null,
    mediaUrls: input.mediaKeys || [],
    coverUrl: input.coverKey || ph(input.title.slice(0, 2), '#4f46e5', '#7c3aed'),
    tags: input.tags || [], externalLink: input.externalLink ?? null, techCode: input.techCode ?? null,
    reviewStatus: 'pass', isDraft: input.draft === true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
  WORKS.push(work)
  // 发布到指定群空间 → 生成投影（PRD 7.3）
  ;(input.spaceIds || []).forEach((spaceId) => {
    PROJECTIONS.push({
      id: Date.now() + Math.floor(Math.random() * 1000), spaceId,
      work, likeCount: 0, commentCount: 0, collectCount: 0,
      projectedAt: work.createdAt, likedByMe: false, _spaceId: spaceId, _workId: work.id
    })
    spaceById(spaceId).workCount += 1
  })
  return ok(work)
}

export async function editWork(id: number, input: UpsertWorkInput): Promise<ApiResult<Work>> {
  await delay()
  const w = WORKS.find((x) => x.id === id)
  if (!w) throw new Error('work not found')
  Object.assign(w, {
    title: input.title, type: input.type, textContent: input.textContent ?? null,
    mediaUrls: input.mediaKeys || [], coverUrl: input.coverKey || w.coverUrl,
    tags: input.tags || [], externalLink: input.externalLink ?? null, techCode: input.techCode ?? null,
    updatedAt: new Date().toISOString()
  })
  return ok(w)
}

/** 软删作品 → 隐藏全部投影（ADR-0009） */
export async function deleteWork(id: number): Promise<ApiResult<null>> {
  await delay()
  const w = WORKS.find((x) => x.id === id)
  if (!w) throw new Error('work not found')
  ;(w as any).isActive = false
  return ok(null)
}

export async function addProjection(workId: number, spaceId: number): Promise<ApiResult<Projection>> {
  await delay()
  const work = WORKS.find((x) => x.id === workId)!
  const proj: Projection = {
    id: Date.now(), spaceId, work, likeCount: 0, commentCount: 0, collectCount: 0,
    projectedAt: new Date().toISOString(), likedByMe: false
  }
  PROJECTIONS.push(proj as any)
  spaceById(spaceId).workCount += 1
  return ok(proj)
}

export async function revokeProjection(projectionId: number): Promise<ApiResult<null>> {
  await delay()
  const idx = PROJECTIONS.findIndex((p) => p.id === projectionId)
  if (idx >= 0) PROJECTIONS.splice(idx, 1)
  return ok(null)
}

/* ---------------- 星轨 ---------------- */

export async function getStarTrail(userId: number, spaceId?: number): Promise<ApiResult<StarTrail>> {
  await delay()
  // 按共同群过滤（ADR-0010）：只统计查看者可访问的投影
  const visible = PROJECTIONS.filter((p) =>
    (spaceId ? p.spaceId === spaceId : true) &&
    membersOf(p.spaceId).some((m) => m.user.id === ME.id)
  )
  const mine = visible.filter((p) => p.work.author.id === userId)
  const dist: StarTrail['typeDistribution'] = {}
  mine.forEach((p) => { dist[p.work.type] = (dist[p.work.type] || 0) + 1 })
  return ok({
    user: { id: userId, nickname: USERS[userId]?.nickname || '用户', avatarUrl: USERS[userId]?.avatarUrl || null },
    workCount: mine.length,
    typeDistribution: dist,
    recentWorks: sortedProjections(mine.slice(0, 10) as Projection[])
  })
}
