import { PropsWithChildren, useEffect, useRef } from 'react'
import { useLaunch } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { AppProvider } from './store'
import { getGroupInfo, joinSpace } from './api'
import './app.scss'

/** App.onShow 参数（Taro 类型未完全覆盖 shareTicket，这里收窄定义） */
interface AppShowOptions {
  path?: string
  query?: Record<string, string>
  scene?: number
  shareTicket?: string
}

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('群星闪耀 App launched.')
  })

  // 群上下文入口（ADR-0008）：从群聊打开分享卡片
  // shareTicket → wx.getShareInfo → 后端解密 openGId → 门禁加入 → 跳目标页。
  const handledTicket = useRef('')

  useEffect(() => {
    Taro.onAppShow(async (options: AppShowOptions) => {
      const { shareTicket, query, path } = options
      console.log('[App onAppShow]', { shareTicket, query, path })
      if (!shareTicket) return
      // 从 path 中解析参数（微信 onAppShow 的 query 可能不完整）
      const url = new URL(path || '', 'http://localhost')
      const pathParams = Object.fromEntries(url.searchParams)
      const mergedQuery = { ...query, ...pathParams }
      const spaceId = Number(mergedQuery?.spaceId || mergedQuery?.id || 0)
      console.log('[App onAppShow] spaceId:', spaceId, 'mergedQuery:', mergedQuery)
      if (!spaceId) return
      // 同一 ticket 只处理一次，避免热启动重复加入/跳转
      if (shareTicket === handledTicket.current) return
      handledTicket.current = shareTicket

      try {
        let openGid: string | undefined
        try {
          const info = await Taro.getShareInfo({ shareTicket })
          const res = await getGroupInfo(shareTicket, info.encryptedData, info.iv)
          openGid = res.data.openGid
        } catch {
          // dev/工具环境拿不到真实 getShareInfo → 不带 openGid 走后端 MVP 降级（直接加入）
        }
        const joinResult = await joinSpace(spaceId, openGid)
        if (joinResult.data.state === 'pending') {
          Taro.showModal({ title: '申请已提交', content: '群主审核通过后即可进入群空间。', showCancel: false })
          Taro.reLaunch({ url: '/pages/index/index' })
          return
        }

        const projectionId = Number(query?.projectionId || 0)
        const target = projectionId
          ? `/pages/work-detail/index?projectionId=${projectionId}&spaceId=${spaceId}`
          : `/pages/space/index?id=${spaceId}`
        Taro.reLaunch({ url: target })
      } catch (err) {
        Taro.showToast({ title: (err as { message?: string }).message || '加入群失败', icon: 'none' })
      }
    })
  }, [])

  return <AppProvider>{children}</AppProvider>
}

export default App
