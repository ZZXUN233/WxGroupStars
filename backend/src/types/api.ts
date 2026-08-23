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
/** 成员准入状态（ADR-0018）：active=正式成员、pending=待审核申请、rejected=已被拒 */
export type MemberStatus = 'active' | 'pending' | 'rejected'
export type TimelineSlice = 'today' | 'week' | 'month' | 'year'

/** 空间加入结果（ADR-0018 双轨）：active=已加入、pending=已申请待审核、rejected=已被拒 */
export interface JoinResultDto {
  state: 'active' | 'pending' | 'rejected'
  space: SpaceDto | null
}

export interface SpaceInviteDto {
  token: string
  expiresAt: string
  space: Pick<SpaceDto, 'id' | 'name'>
}

export interface SpaceDto {
  id: number
  name: string
  coverUrl: string | null
  creatorId: number
  memberCount: number
  workCount: number
  pendingCount: number
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

export interface WorkProjectedSpaceDto {
  /** 投影 ID（撤销投影时使用） */
  projectionId: number
  /** 群空间 ID */
  id: number
  name: string
}

export interface WorkDetailDto extends WorkDto {
  projectedSpaces: WorkProjectedSpaceDto[]
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

export interface StarTrailWorkDto extends WorkDto {
  /** 星轨进入详情时使用的当前用户可访问投影 */
  projectionId: number
  spaceId: number
}

export interface MemberDto {
  id: number
  user: UserDto
  role: MemberRole
  status: MemberStatus
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
  recentWorks: StarTrailWorkDto[]
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
  /** true=保存草稿（不投影）；false=从草稿发布；undefined=普通发布/编辑 */
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

/** 个人分享生成结果（ADR-0018）：token 拼入分享页路由 /pages/work-share/index?token=… */
export interface WorkShareResultDto {
  token: string
}
