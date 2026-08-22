import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import WorkCard from '../../components/WorkCard'
import type { Space } from '../../types'
import { getFeed, getMySpaces } from '../../api'
import './index.scss'

export default function Index() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [feed, setFeed] = useState<{ projection: any; space: { id: number; name: string } }[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [sp, fd] = await Promise.all([getMySpaces(), getFeed()])
      setSpaces(sp.data)
      setFeed(fd.data.items)
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => { load() })

  const goSpace = (id: number) => Taro.navigateTo({ url: `/pages/space/index?id=${id}` })
  const goCreate = () => Taro.navigateTo({ url: '/pages/create-space/index' })
  const goPublish = () => Taro.navigateTo({ url: '/pages/publish/index' })
  const goSearch = () => Taro.navigateTo({ url: '/pages/search/index' })

  return (
    <View className='index'>
      <View className='section-title'>
        我的群
        <Text className='title-right' onClick={goSearch}>🔍 群内搜索</Text>
      </View>
      <View className='space-list'>
        {spaces.map((s) => (
          <View key={s.id} className='card space-card' onClick={() => goSpace(s.id)}>
            <View className='space-logo-wrap'>
              <View className='space-logo'>⭐</View>
              {s.pendingCount ? <Text className='pending-badge'>{s.pendingCount > 99 ? '99+' : s.pendingCount}</Text> : null}
            </View>
            <View className='space-info'>
              <View className='space-name'>{s.name}</View>
              <View className='space-meta'>{s.workCount} 作品 · {s.memberCount} 成员</View>
            </View>
            {s.myRole === 'owner' ? <Text className='space-role'>我管理</Text> : null}
          </View>
        ))}
      </View>
      <View className='btn create-btn' onClick={goCreate}>＋ 创建群空间</View>

      <View className='section-title'>
        最新星光
        <Text className={`title-right refresh-action ${loading ? 'loading' : ''}`} onClick={load}>↻ 刷新</Text>
      </View>
      {loading ? <View className='empty'>加载中…</View> : (
        feed.length ? feed.map((item) => (
          <WorkCard key={item.projection.id} projection={item.projection} spaceName={item.space.name} />
        )) : <View className='empty'>还没有星光，快发布第一件作品吧</View>
      )}
      <View className='fab' onClick={goPublish}>＋</View>
    </View>
  )
}
