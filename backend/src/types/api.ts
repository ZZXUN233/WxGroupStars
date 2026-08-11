/**
 * API 响应类型（与前端 src/types/index.ts 对齐）。
 * 所有接口统一返回 ApiResult<T>：code=0 成功，非 0 失败。
 */

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export interface PageDto<T> {
  items: T[]
  page: number
  hasMore: boolean
}

export interface UserDto {
  id: number
  nickname: string | null
  avatarUrl: string | null
}

export interface SessionDto {
  token: string
  user: UserDto
}

/** 群信息解密结果（ADR-0008）：shareTicket 解出的群标识，门禁校验用 */
export interface GroupInfoResult {
  openGid: string
}

export type WorkType = 'text' | 'image' | 'audio_video' | 'tech' | 'external'
export type MemberRole = 'member' | 'admin' | 'owner'
export type TimelineSlice = 'today' | 'week' | 'month' | 'year'

export interface SpaceDto {
  id: number
  name: string
  coverUrl: string | null
  creatorId: number
  memberCount: number
  workCount: number
  myRole: MemberRole
  createdAt: string
}

export interface WorkDto {
  id: number
  title: string
  author: UserDto
  type: WorkType
  textContent: string | null
  mediaUrls: string[]
  coverUrl: string | null
  tags: string[]
  externalLink: string | null
  techCode: string | null
  reviewStatus: 'pass' | 'pending' | 'fail'
  /** 草稿（Work.is_draft）：草稿不投影到群、feed 不可见，仅作者可见 */
  isDraft: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectionDto {
  id: number
  spaceId: number
  work: WorkDto
  likeCount: number
  commentCount: number
  collectCount: number
  /** projection.created_at —— 时间轴排序基准（ADR-0002） */
  projectedAt: string
  likedByMe: boolean
}

export interface MemberDto {
  id: number
  user: UserDto
  role: MemberRole
  joinedAt: string
}

export interface CommentDto {
  id: number
  user: UserDto
  content: string
  replyToUser: UserDto | null
  replies: CommentDto[]
  createdAt: string
  isMine: boolean
}

export interface FeedItemDto {
  projection: ProjectionDto
  space: { id: number; name: string }
}

export interface StarTrailDto {
  user: UserDto
  workCount: number
  typeDistribution: Partial<Record<WorkType, number>>
  recentWorks: ProjectionDto[]
}

export interface CreateSpaceInput {
  name: string
  coverUrl?: string | null
}

export interface UpsertWorkInput {
  title: string
  type: WorkType
  textContent?: string | null
  mediaKeys?: string[]
  coverKey?: string | null
  tags?: string[]
  externalLink?: string | null
  techCode?: string | null
  /** true=保存草稿（不投影）；false=从草稿发布（需 spaceIds）；undefined=普通发布/编辑 */
  draft?: boolean
  spaceIds?: number[]
}

export interface CreateCommentInput {
  content: string
  parentId?: number | null
  replyToUserId?: number | null
}

/** COS 直传签名（ADR-0005）：前端按 { url, fields } 发起 Taro.uploadFile */
export interface PresignResult {
  key: string
  url: string
  fields: Record<string, string>
}
