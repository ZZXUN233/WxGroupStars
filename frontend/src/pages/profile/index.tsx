import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import WorkCard from '../../components/WorkCard'
import { useApp } from '../../store'
import type { StarTrail, WorkType } from '../../types'
import { getStarTrail } from '../../api'
import { displayName, initial } from '../../utils/format'
import { WORK_TYPE_EMOJI, WORK_TYPE_LABEL } from '../../utils/workType'
import './index.scss'

const TYPES: WorkType[] = ['text', 'image', 'audio_video', 'tech', 'external']

export default function Profile() {
  const { user } = useApp()
  const [userId, setUserId] = useState(0)
  const [spaceId, setSpaceId] = useState(0)
  const [trail, setTrail] = useState<StarTrail | null>(null)

  const loadTrail = async (uid: number, sid: number) => {
    if (!uid) return
    const res = await getStarTrail(uid, sid || undefined)
    setTrail(res.data)
    if (res.data.user.id !== user?.id) {
      Taro.setNavigationBarTitle({ title: `${displayName(res.data.user.nickname)} · 星轨` })
    }
  }

  useLoad((params) => {
    const uid = Number(params?.userId || user?.id || 0)
    const sid = Number(params?.spaceId || 0)
    setUserId(uid)
    setSpaceId(sid)
    loadTrail(uid, sid)
  })

  // tab 切换回来时刷新
  useDidShow(() => {
    if (userId) loadTrail(userId, spaceId)
  })

  // 兜底：tab 进入时 user 尚未就绪（store 异步登录），就绪后加载自己的星轨
  useEffect(() => {
    if (!userId && user) {
      setUserId(user.id)
      loadTrail(user.id, spaceId)
    }
  }, [user])

  if (!trail) return <View className='empty'>加载中…</View>

  const dist = trail.typeDistribution
  return (
    <ScrollView scrollY className='trail'>
      <View className='profile-head'>
        <View className='avatar profile-avatar'>
          {trail.user.avatarUrl ? <Image src={trail.user.avatarUrl} mode='aspectFill' /> : <Text>{initial(trail.user.nickname)}</Text>}
        </View>
        <View className='profile-info'>
          <View className='profile-name'>{displayName(trail.user.nickname)}</View>
          <View className='profile-stats'>累计发布 {trail.workCount} 件作品</View>
        </View>
      </View>

      {/* 昵称未设置时引导同步微信资料（昵称仅首次设置，之后锁定） */}
      {trail.user.id === user?.id && !user?.nickname ? (
        <View className='profile-guide' onClick={() => Taro.navigateTo({ url: '/pages/edit-profile/index' })}>
          <Text className='profile-guide-text'>👤 你还没设置昵称头像，点此同步微信资料</Text>
          <Text className='profile-guide-arrow'>›</Text>
        </View>
      ) : null}

      {/* 仅查看自己星轨时显示个人管理入口 */}
      {trail.user.id === user?.id ? (
        <View className='profile-entries'>
          <View className='entry' onClick={() => Taro.navigateTo({ url: '/pages/edit-profile/index' })}>
            <Text className='entry-label'>✏️ 编辑资料</Text>
            <Text className='entry-arrow'>›</Text>
          </View>
          <View className='entry' onClick={() => Taro.navigateTo({ url: '/pages/drafts/index' })}>
            <Text className='entry-label'>📝 我的草稿</Text>
            <Text className='entry-arrow'>›</Text>
          </View>
        </View>
      ) : null}

      <View className='section-title'>创作类型</View>
      <View className='dist-row card'>
        {TYPES.map((t) => (
          <View key={t} className='dist-item'>
            <Text className='dist-emoji'>{WORK_TYPE_EMOJI[t]}</Text>
            <Text className='dist-count'>{dist[t] || 0}</Text>
            <Text className='dist-label'>{WORK_TYPE_LABEL[t]}</Text>
          </View>
        ))}
      </View>

      <View className='section-title'>近期星光</View>
      {trail.recentWorks.length
        ? trail.recentWorks.map((p) => <WorkCard key={p.id} projection={p} />)
        : <View className='empty'>还没有作品，快发布第一颗星吧</View>}
    </ScrollView>
  )
}
