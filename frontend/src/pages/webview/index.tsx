import Taro, { useRouter } from '@tarojs/taro'
import { WebView } from '@tarojs/components'

export default function Webview() {
  const router = useRouter()
  const url = decodeURIComponent(router.params.url || '')

  if (!url) {
    return <view>无效的链接</view>
  }

  return <WebView src={url} />
}
