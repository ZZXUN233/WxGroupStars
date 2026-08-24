import { useRouter } from '@tarojs/taro'
import { View, WebView } from '@tarojs/components'

/** 安全审计 H-5：WebView URL 域名白名单 */
const ALLOWED_HOSTS = ['gs.zzxun.cn', 'zzxun.cn']

export default function Webview() {
  const router = useRouter()
  const url = decodeURIComponent(router.params.url || '')

  if (!url) {
    return <View className='empty'>无效的链接</View>
  }

  // 校验 URL 域名是否在白名单内
  try {
    const { host } = new URL(url)
    const matched = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
    if (!matched) {
      return <View className='empty'>该链接不被允许打开</View>
    }
  } catch {
    return <View className='empty'>链接格式无效</View>
  }

  return <WebView src={url} />
}
