/**
 * API 层（业务入口）—— 对接真实后端
 * 与 mock 契约一致：统一返回 ApiResult<T>，页面无需改动。
 * 后端 dev 模式（WX_APPID/WX_SECRET 为空）下 openid = dev_<code>，
 * 因此开发环境用持久化 devUid 作为 code，保证登录态跨启动稳定。
 */
import Taro from '@tarojs/taro'
import { get, post, put, patch, del, setAuthHandler } from './http'
import type {
  ApiResult, Comment, CreateCommentInput, CreateSpaceInput, FeedItem, Member,
  JoinResult, Page, PresignResult, Projection, Session, Space, StarTrail, TimelineSlice, UpsertWorkInput, User, Work,
} from '../types'

function ok<T>(data: T): ApiResult<T> {
  return { code: 0, message: 'ok', data }
}

/** COS 媒体访问域名（与后端 .env COS_BASE_URL 一致，用于识别已有对象 / 提取 object key） */
export const COS_BASE_URL = 'https://zzx-wxgs-1251818151.cos.ap-guangzhou.myqcloud.com'

/**
 * 登录 code 获取：wx.login 真 code。
 * 后端配置真实 WX_APPID/WX_SECRET 后，code 经 code2session 换真实 openid（真机独立身份）；
 * 后端未配置凭据时进入 dev 模式，固定 DEV_OPENID 身份、与 code 内容无关，
 * 因此任何构建模式直接用 Taro.login() 都安全（dev 身份稳定，真实模式才用真 code）。
 */
async function getLoginCode(): Promise<string> {
  const { code } = await Taro.login()
  return code
}

/* ---------------- 认证（自动登录兜底） ---------------- */

/** 串起并发登录：多个接口同时发现没 token 时，只发一次 /auth/login */
let pendingLogin: Promise<Session> | null = null
let lastSession: Session | null = null

async function doLogin(): Promise<Session> {
  const data = await post<Session>('/auth/login', { code: await getLoginCode() })
  Taro.setStorageSync('gs_token', data.token)
  lastSession = data
  return data
}

function ensureLogin(): Promise<Session> {
  if (lastSession) return Promise.resolve(lastSession)
  if (!pendingLogin) {
    pendingLogin = doLogin().catch((err) => {
      pendingLogin = null // 失败后允许下次重试
      throw err
    })
  }
  return pendingLogin
}

// 注册到 http 层：任何鉴权请求在无 token 时先登录（首页并行请求不会 401）
setAuthHandler(async () => {
  await ensureLogin()
})

/* ---------------- 认证 ---------------- */

export async function login(): Promise<ApiResult<Session>> {
  return ok(await ensureLogin())
}

/** 当前用户最新资料（绕过 login 的 lastSession 缓存，进入编辑资料页时拉取最新昵称/头像） */
export async function getMe(): Promise<ApiResult<User>> {
  return ok(await get<User>('/auth/me'))
}

/** 群上下文解密（ADR-0008）：shareTicket → openGid，从群聊打开分享卡片时调用 */
export async function getGroupInfo(shareTicket: string, encryptedData: string, iv: string): Promise<ApiResult<{ openGid: string }>> {
  return ok(await post<{ openGid: string }>('/auth/group-info', { shareTicket, encryptedData, iv }))
}

/** 更新昵称/头像（微信「头像昵称填写」，avatarUrl 为 COS 完整 URL；传 null 可清除头像） */
export async function updateProfile(input: { nickname?: string; avatarUrl?: string | null }): Promise<ApiResult<User>> {
  return ok(await patch<User>('/auth/profile', input))
}

/* ---------------- 群空间 ---------------- */

export async function getMySpaces(): Promise<ApiResult<Space[]>> {
  return ok(await get<Space[]>('/spaces/mine'))
}

export async function getSpaceDetail(id: number): Promise<ApiResult<Space>> {
  return ok(await get<Space>(`/spaces/${id}`))
}

export async function getSpaceMembers(id: number): Promise<ApiResult<Member[]>> {
  return ok(await get<Member[]>(`/spaces/${id}/members`))
}

export async function getMemberRequests(id: number): Promise<ApiResult<Member[]>> {
  return ok(await get<Member[]>(`/spaces/${id}/member-requests`))
}

export async function reviewMember(id: number, memberId: number, approved: boolean): Promise<ApiResult<Member>> {
  const action = approved ? 'approve' : 'reject'
  return ok(await post<Member>(`/spaces/${id}/member-requests/${memberId}/${action}`, {}))
}

export async function createSpaceInvite(id: number): Promise<ApiResult<{ token: string; expiresAt: string; space: Pick<Space, 'id' | 'name'> }>> {
  return ok(await post(`/spaces/${id}/invites`, {}))
}

export async function acceptSpaceInvite(token: string): Promise<ApiResult<JoinResult>> {
  return ok(await post<JoinResult>(`/spaces/invites/${token}/accept`, {}))
}

export async function createSpace(input: CreateSpaceInput): Promise<ApiResult<Space>> {
  return ok(await post<Space>('/spaces', input))
}

export async function updateSpace(id: number, input: { name?: string; coverUrl?: string | null }): Promise<ApiResult<Space>> {
  return ok(await put<Space>(`/spaces/${id}`, input))
}

export async function transferOwner(spaceId: number, memberId: number): Promise<ApiResult<Space>> {
  return ok(await post<Space>(`/spaces/${spaceId}/transfer-owner`, { memberId }))
}

export async function joinSpace(spaceId: number, openGid?: string): Promise<ApiResult<JoinResult>> {
  return ok(await post<JoinResult>(`/spaces/${spaceId}/join`, openGid ? { openGid } : {}))
}

export async function getSpaceTimeline(spaceId: number, slice: TimelineSlice, page = 1): Promise<ApiResult<Page<Projection>>> {
  return ok(await get<Page<Projection>>(`/spaces/${spaceId}/timeline`, { slice, page }))
}

/* ---------------- 聚合 ---------------- */

export async function getFeed(page = 1): Promise<ApiResult<Page<FeedItem>>> {
  return ok(await get<Page<FeedItem>>('/feed', { page }))
}

export async function searchInSpace(spaceId: number, q: string): Promise<ApiResult<Projection[]>> {
  return ok(await get<Projection[]>(`/spaces/${spaceId}/search`, { q }))
}

export async function getStarTrail(userId: number, spaceId?: number): Promise<ApiResult<StarTrail>> {
  return ok(await get<StarTrail>(`/users/${userId}/star-trail`, spaceId ? { spaceId } : undefined))
}

/* ---------------- 媒体上传（ADR-0005 COS 直传） ---------------- */

/** 向后端签发 COS 直传签名（返回 { key, url, fields }） */
export async function getPresign(filename: string): Promise<ApiResult<PresignResult>> {
  return ok(await post<PresignResult>('/uploads/presign', { filename }))
}

/** 直传 COS：multipart/form-data POST（COS 成功响应可能是 200、201 或 204） */
export async function uploadToCos(filePath: string, presign: PresignResult): Promise<void> {
  const res = await Taro.uploadFile({ url: presign.url, filePath, name: 'file', formData: presign.fields })
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const detail = typeof res.data === 'string' && res.data ? `：${res.data.slice(0, 80)}` : ''
    throw new Error(`头像上传失败（HTTP ${res.statusCode}${detail}）`)
  }
}

/* ---------------- 作品 / 投影 ---------------- */

export async function getProjection(id: number): Promise<ApiResult<Projection>> {
  return ok(await get<Projection>(`/projections/${id}`))
}

export async function getWork(id: number): Promise<ApiResult<Work>> {
  return ok(await get<Work>(`/works/${id}`))
}

export async function publishWork(input: UpsertWorkInput): Promise<ApiResult<Work>> {
  return ok(await post<Work>('/works', input))
}

export async function editWork(id: number, input: UpsertWorkInput): Promise<ApiResult<Work>> {
  return ok(await patch<Work>(`/works/${id}`, input))
}

export async function deleteWork(id: number): Promise<ApiResult<null>> {
  await del(`/works/${id}`)
  return ok(null)
}

/** 我的草稿列表（最新在前），供「我的草稿」入口继续编辑 */
export async function getMyDrafts(): Promise<ApiResult<Work[]>> {
  return ok(await get<Work[]>('/works/drafts'))
}

export async function addProjection(workId: number, spaceId: number): Promise<ApiResult<Projection>> {
  return ok(await post<Projection>(`/works/${workId}/projections`, { spaceId }))
}

export async function revokeProjection(projectionId: number): Promise<ApiResult<null>> {
  await del(`/projections/${projectionId}`)
  return ok(null)
}

/* ---------------- 互动 ---------------- */

export async function toggleLike(projectionId: number): Promise<ApiResult<{ liked: boolean; likeCount: number }>> {
  return ok(await post<{ liked: boolean; likeCount: number }>(`/projections/${projectionId}/like`))
}

export async function getComments(projectionId: number): Promise<ApiResult<Comment[]>> {
  return ok(await get<Comment[]>(`/projections/${projectionId}/comments`))
}

export async function createComment(projectionId: number, input: CreateCommentInput): Promise<ApiResult<Comment>> {
  return ok(await post<Comment>(`/projections/${projectionId}/comments`, input))
}

export async function deleteComment(commentId: number): Promise<ApiResult<null>> {
  await del(`/comments/${commentId}`)
  return ok(null)
}
