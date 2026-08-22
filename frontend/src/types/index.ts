/**
 * 群星闪耀 · 接口契约（前端先行，后端按此实现）
 * 对齐 docs/schema.md 与 CONTEXT.md 术语。
 */

/** 作品类型（五种） */
export type WorkType = 'text' | 'image' | 'audio_video' | 'tech' | 'external'

/** 成员角色 */
export type MemberRole = 'member' | 'admin' | 'owner'
export type MemberStatus = 'active' | 'pending' | 'rejected'

/** 时间轴切片（日历口径，ADR-0002） */
export type TimelineSlice = 'today' | 'week' | 'month' | 'year'

/** 内容审核状态（ADR-0014） */
export type ReviewStatus = 'pass' | 'pending' | 'fail'

/** 统一响应包裹 */
export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

/** 分页 */
export interface Page<T> {
  items: T[]
  page: number
  hasMore: boolean
}

/** 用户（user.id 中立身份） */
export interface User {
  id: number
  /** 昵称可为空：微信登录不返回昵称，由「头像昵称填写」主动设置（PATCH /auth/profile） */
  nickname: string | null
  avatarUrl: string | null
}

/** 登录会话 */
export interface Session {
  token: string
  user: User
}

/** 群空间（Space） */
export interface Space {
  id: number
  name: string
  coverUrl: string | null
  creatorId: number
  memberCount: number
  workCount: number
  pendingCount?: number
  myRole: MemberRole
  createdAt: string
}

export type SpaceAccessState = 'active' | 'pending' | 'rejected' | 'none'

export interface SpaceAccessInfo {
  space: Pick<Space, 'id' | 'name' | 'coverUrl' | 'creatorId' | 'createdAt'>
  owner: User
  state: SpaceAccessState
}

/** 作品本体（Work，跨群一致） */
export interface Work {
  id: number
  title: string
  author: User
  type: WorkType
  textContent: string | null
  /** 图片 1-9 张 / 音视频单条（ADR-0005） */
  mediaUrls: string[]
  coverUrl: string
  tags: string[]
  externalLink: string | null
  techCode: string | null
  reviewStatus: ReviewStatus
  /** 草稿：不投影到群、feed 不可见，仅作者可见（编辑后未发布的中间态） */
  isDraft: boolean
  createdAt: string
  updatedAt: string
}

/** 作品详情中当前用户可见的投影群空间 */
export interface WorkProjectedSpace {
  id: number
  name: string
}

export interface WorkDetail extends Work {
  projectedSpaces: WorkProjectedSpace[]
}

/** 群内投影（Projection，独立持有互动计数） */
export interface Projection {
  id: number
  spaceId: number
  work: Work
  likeCount: number
  commentCount: number
  collectCount: number
  /** projection.created_at —— 时间轴排序基准 */
  projectedAt: string
  likedByMe: boolean
}

/** 星轨作品：作品本体之外保留一个可访问投影作为详情入口 */
export interface StarTrailWork extends Work {
  projectionId: number
  spaceId: number
}

/** 成员（Member） */
export interface Member {
  id: number
  user: User
  role: MemberRole
  status: MemberStatus
  joinedAt: string
}

export interface JoinResult {
  state: 'active' | 'pending' | 'rejected'
  space: Space | null
}

/** 评论（两级结构：评论 + 一级回复，ADR-0007） */
export interface Comment {
  id: number
  user: User
  content: string
  replyToUser: User | null
  replies: Comment[]
  createdAt: string
  isMine: boolean
}

/** 最新星光（跨群信息流，按成员资格过滤，ADR-0010） */
export interface FeedItem {
  projection: Projection
  space: Pick<Space, 'id' | 'name'>
}

/** 星轨（作者档案，按共同群过滤，ADR-0010） */
export interface StarTrail {
  user: User
  workCount: number
  /** 分类分布：type -> count */
  typeDistribution: Partial<Record<WorkType, number>>
  recentWorks: StarTrailWork[]
}

/** 创建群空间入参 */
export interface CreateSpaceInput {
  name: string
  coverUrl?: string | null
}

/** 发布/编辑作品入参 */
export interface UpsertWorkInput {
  title: string
  type: WorkType
  textContent?: string | null
  /** COS object key 数组（图片 1-9）或单 key */
  mediaKeys?: string[]
  coverKey?: string | null
  tags?: string[]
  externalLink?: string | null
  techCode?: string | null
  /** true=保存草稿（不投影）；false=从草稿发布（需 spaceIds） */
  draft?: boolean
  /** 发布时指定投影到的群空间（PRD 7.3） */
  spaceIds?: number[]
}

/** 发表评论入参 */
export interface CreateCommentInput {
  content: string
  parentId?: number | null
  replyToUserId?: number | null
}

/** COS 直传签名（ADR-0005）：Taro.uploadFile 用 { url, fields } 直传对象存储 */
export interface PresignResult {
  key: string
  url: string
  fields: Record<string, string>
}
