/**
 * API 层（业务入口）—— 对接真实后端
 * 与 mock 契约一致：统一返回 ApiResult<T>，页面无需改动。
 * 后端 dev 模式（WX_APPID/WX_SECRET 为空）下 openid = dev_<code>，
 * 因此开发环境用持久化 devUid 作为 code，保证登录态跨启动稳定。
 */
import Taro from '@tarojs/taro'
import { get, post, put, del, setAuthHandler } from './http'
import type {
  ApiResult, Comment, CreateCommentInput, CreateSpaceInput, FeedItem, Member,
  Page, PresignResult, Projection, Session, Space, StarTrail, TimelineSlice, UpsertWorkInput, Work,
} from '../types'

function ok<T>(data: T): ApiResult<T> {
  return { code: 0, message: 'ok', data }
}

/** COS 媒体访问域名（与后端 .env COS_BASE_URL 一致，用于识别已有对象 / 提取 object key） */
export const COS_BASE_URL = 'https://zzx-wxgs-1251818151.cos.ap-guangzhou.myqcloud.com'

/**
 * 登录 code 获取。
 * 本地联调阶段（后端 dev 模式：WX_APPID/WX_SECRET 为空）用本机持久化 devUid，
 * 保证任何构建模式下登录态都稳定（避免 wx.login 单次 code 每次新建用户）。
 * ⚠️ 真实部署（配置真实 AppID 走微信 code2session）时，需改为 `const { code } = await Taro.login()`。
 */
async function getLoginCode(): Promise<string> {
  let uid = Taro.getStorageSync('gs_dev_uid')
  if (!uid) {
    uid = Math.random().toString(36).slice(2, 10)
    Taro.setStorageSync('gs_dev_uid', uid)
  }
  return uid
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

/** 群上下文解密（ADR-0008）：shareTicket → openGid，从群聊打开分享卡片时调用 */
export async function getGroupInfo(shareTicket: string, encryptedData: string, iv: string): Promise<ApiResult<{ openGid: string }>> {
  return ok(await post<{ openGid: string }>('/auth/group-info', { shareTicket, encryptedData, iv }))
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

export async function createSpace(input: CreateSpaceInput): Promise<ApiResult<Space>> {
  return ok(await post<Space>('/spaces', input))
}

export async function updateSpace(id: number, input: { name?: string; coverUrl?: string | null }): Promise<ApiResult<Space>> {
  return ok(await put<Space>(`/spaces/${id}`, input))
}

export async function transferOwner(spaceId: number, memberId: number): Promise<ApiResult<Space>> {
  return ok(await post<Space>(`/spaces/${spaceId}/transfer-owner`, { memberId }))
}

export async function joinSpace(spaceId: number, openGid?: string): Promise<ApiResult<Space>> {
  return ok(await post<Space>(`/spaces/${spaceId}/join`, openGid ? { openGid } : {}))
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

/** 直传 COS：multipart/form-data POST（Taro.uploadFile 默认 POST），204/200 为成功 */
export async function uploadToCos(filePath: string, presign: PresignResult): Promise<void> {
  const res = await Taro.uploadFile({ url: presign.url, filePath, name: 'file', formData: presign.fields })
  if (res.statusCode !== 200 && res.statusCode !== 204) {
    throw new Error(`上传失败（HTTP ${res.statusCode}）`)
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
  return ok(await put<Work>(`/works/${id}`, input))
}

export async function deleteWork(id: number): Promise<ApiResult<null>> {
  await del(`/works/${id}`)
  return ok(null)
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
