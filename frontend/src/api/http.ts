/**
 * HTTP 请求封装（真实后端）
 * 当前 api 层已切到真实后端；开发环境默认连本地后端，
 * 生产域名通过 .env 的 TARO_APP_BASE_URL 注入（ADR-0013）。
 */
import Taro from '@tarojs/taro'
import type { ApiResult } from '../types'

// 本地联调默认访问 http://localhost:3000；微信开发者工具需勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」；
// 真机联调用局域网 IP（本机 WLAN 192.168.31.80），真机需与开发机同网段；
// 正式上线使用 gs.zzxun.cn 作为 API 域名（ADR-0013）。
// 注：小程序运行时没有 process，勿在此用 process.env 注入。
const BASE_URL = process.env.TARO_APP_BASE_URL || 'https://gs.zzxun.cn'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
}

/**
 * 登录兜底钩子：由 api 层注册（避免 http ↔ api 循环依赖）。
 * 每个需要鉴权的请求发出去前，若本地没有 token，先走登录拿 token，
 * 这样首页并行发起 feed/spaces 时不会因为登录未完成而 401。
 */
let ensureAuth: (() => Promise<void>) | null = null
export function setAuthHandler(fn: () => Promise<void>): void {
  ensureAuth = fn
}

export type ClientErrorStage = 'request' | 'upload' | 'save' | 'login' | 'render' | 'unknown'

let reportingClientError = false

/** 统一上报前端错误；上报失败静默处理，避免错误上报形成递归。 */
export function reportClientError(
  stage: ClientErrorStage,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  if (reportingClientError) return
  reportingClientError = true
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const page = (() => {
    try {
      return Taro.getCurrentPages?.().slice(-1)[0]?.route
    } catch {
      return undefined
    }
  })()
  Taro.request({
    url: `${BASE_URL}/diagnostics/client-error`,
    method: 'POST',
    data: { stage, message, stack, page, context },
    header: (() => {
      const token = Taro.getStorageSync('gs_token') || ''
      return token ? { Authorization: `Bearer ${token}` } : undefined
    })(),
    timeout: 5000,
  }).catch(() => undefined).finally(() => { reportingClientError = false })
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  try {
    // 登录接口自身不触发登录（避免死循环）；其余接口（含 /auth/me 等鉴权接口）无 token 时先登录
    if (ensureAuth && !url.startsWith('/auth/login')) {
      await ensureAuth()
    }
    const token = Taro.getStorageSync('gs_token') || ''
    const res = await Taro.request<ApiResult<T>>({
      url: `${BASE_URL}${url}`,
      method: options.method || 'GET',
      data: options.data as any,
      header: token ? { Authorization: `Bearer ${token}` } : undefined
    })
    if (res.statusCode >= 200 && res.statusCode < 300 && res.data.code === 0) {
      return res.data.data
    }
    if (res.statusCode === 401) {
      Taro.removeStorageSync('gs_token')
      Taro.navigateTo({ url: '/pages/index/index' })
    }
    throw new Error(res.data?.message || `请求失败 (${res.statusCode})`)
  } catch (error) {
    reportClientError('request', error, { method: options.method || 'GET', endpoint: url })
    throw error
  }
}

export const get = <T>(url: string, data?: unknown) => request<T>(url, { method: 'GET', data })
export const post = <T>(url: string, data?: unknown) => request<T>(url, { method: 'POST', data })
export const put = <T>(url: string, data?: unknown) => request<T>(url, { method: 'PUT', data })
export const patch = <T>(url: string, data?: unknown) => request<T>(url, { method: 'PATCH', data })
export const del = <T>(url: string, data?: unknown) => request<T>(url, { method: 'DELETE', data })
