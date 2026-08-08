/**
 * HTTP 请求封装（真实后端接入时启用）
 * 当前 api 层指向 mock；后端就绪后，将 src/api/index.ts 的实现替换为基于本文件的调用。
 */
import Taro from '@tarojs/taro'
import type { ApiResult } from '../types'

const BASE_URL = 'https://api.zzxun.cn/group-stars' // TODO: 备案域名（ADR-0013）

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
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
}

export const get = <T>(url: string, data?: unknown) => request<T>(url, { method: 'GET', data })
export const post = <T>(url: string, data?: unknown) => request<T>(url, { method: 'POST', data })
export const put = <T>(url: string, data?: unknown) => request<T>(url, { method: 'PUT', data })
export const del = <T>(url: string, data?: unknown) => request<T>(url, { method: 'DELETE', data })
