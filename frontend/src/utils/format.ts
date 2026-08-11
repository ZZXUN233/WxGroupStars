/** 时间格式化 */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const min = 60e3, hour = 3600e3, day = 86400e3
  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 昵称兜底：未设置（微信 code2session 不返回昵称，需用户主动填写）时显示占位 */
export function displayName(nickname: string | null | undefined): string {
  const n = (nickname || '').trim()
  return n || '微信用户'
}

/** 头像占位首字：未设置昵称时显示「微」 */
export function initial(nickname: string | null | undefined): string {
  const n = (nickname || '').trim()
  return n ? n.slice(0, 1) : '微'
}
