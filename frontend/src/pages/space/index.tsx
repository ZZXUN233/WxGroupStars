import { Button, Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import WorkCard from '../../components/WorkCard'
import type { Member, Projection, Space, TimelineSlice } from '../../types'
import { getMemberRequests, getSpaceDetail, getSpaceMembers, getSpaceTimeline, reviewMember, transferOwner, updateSpace } from '../../api'
import { displayName, initial } from '../../utils/format'
import './index.scss'

const SLICES: { key: TimelineSlice; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '年度' }
]

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${week}`
}

export default function Space() {
  const [spaceId, setSpaceId] = useState<number>(0)
  const [space, setSpace] = useState<Space | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [slice, setSlice] = useState<TimelineSlice>('month')
  const [timeline, setTimeline] = useState<Projection[]>([])

  useLoad((params) => {
    const id = Number(params?.id || 0)
    setSpaceId(id)
    load(id)
  })

  const load = async (id: number, sl = 'month' as TimelineSlice) => {
    const [sp, mem, tl] = await Promise.all([
      getSpaceDetail(id),
      getSpaceMembers(id),
      getSpaceTimeline(id, sl)
    ])
    setSpace(sp.data)
    setMembers(mem.data)
    setTimeline(tl.data.items)
    Taro.setNavigationBarTitle({ title: sp.data.name })
  }

  const switchSlice = (sl: TimelineSlice) => {
    setSlice(sl)
    getSpaceTimeline(spaceId, sl).then((res) => setTimeline(res.data.items))
  }

  // 按日期分组展示
  const groups = useMemo(() => {
    const map = new Map<string, Projection[]>()
    timeline.forEach((p) => {
      const key = dayLabel(p.projectedAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    })
    return Array.from(map.entries())
  }, [timeline])

  const canManage = space?.myRole === 'owner' || space?.myRole === 'admin'
  const goMember = (m: Member) => Taro.navigateTo({ url: `/pages/profile/index?userId=${m.user.id}&spaceId=${spaceId}` })
  const goPublish = () => Taro.navigateTo({ url: `/pages/publish/index?spaceId=${spaceId}` })
  const goSearch = () => Taro.navigateTo({ url: `/pages/search/index?spaceId=${spaceId}` })

  // 群空间分享卡片：群友在群内打开 → 门禁自动加入（ADR-0008）
  useShareAppMessage(() => ({
    title: space ? `${space.name} · 群星闪耀` : '群星闪耀',
    path: `/pages/space/index?spaceId=${spaceId}`,
    withShareTicket: true,
  }))

  const onManage = () => {
    if (!space) return
    const items = space.myRole === 'owner' ? ['修改群空间名称', '转让管理权', '审核加入申请'] : ['审核加入申请']
    Taro.showActionSheet({
      itemList: items,
      success: async (res) => {
        if (space.myRole === 'owner' && res.tapIndex === 0) {
          const r = await Taro.showModal({ title: '修改名称', editable: true, placeholderText: space.name })
          if (r.confirm && r.content) {
            const updated = await updateSpace(space.id, { name: r.content })
            setSpace(updated.data)
            Taro.setNavigationBarTitle({ title: r.content })
          }
        } else if (space.myRole === 'owner' && res.tapIndex === 1) {
          const owner = members.find((m) => m.role === 'owner')
          const others = members.filter((m) => m.user.id !== owner?.user.id)
          const idx = others.map((m) => displayName(m.user.nickname))
          const pick = await Taro.showActionSheet({ itemList: idx })
          if (pick.tapIndex >= 0) {
            await transferOwner(space.id, others[pick.tapIndex].id)
            Taro.showToast({ title: '已转让', icon: 'success' })
            load(space.id, slice)
          }
        } else {
          const requests = await getMemberRequests(space.id)
          if (!requests.data.length) {
            Taro.showToast({ title: '暂无待审核申请', icon: 'none' })
            return
          }
          const request = requests.data[0]
          const name = displayName(request.user.nickname)
          const result = await Taro.showModal({ title: '加入申请', content: `${name} 申请加入该群空间，是否通过？`, confirmText: '通过', cancelText: '拒绝' })
          await reviewMember(space.id, request.id, result.confirm)
          Taro.showToast({ title: result.confirm ? '已通过' : '已拒绝', icon: 'success' })
          load(space.id, slice)
        }
      }
    })
  }

  return (
    <View className='space'>
      {space && (
        <View className='space-head'>
          <View className='space-cover'>{space.coverUrl ? <Image src={space.coverUrl} mode='aspectFill' /> : <Text className='space-emoji'>⭐</Text>}</View>
          <View className='space-head-info'>
            <View className='space-name-row'>
              <Text className='space-title'>{space.name}</Text>
              <Text className='search-btn' onClick={goSearch}>🔍</Text>
              <Button className='share-btn' openType='share'>分享</Button>
              {canManage ? <Text className='manage-btn' onClick={onManage}>管理</Text> : null}
            </View>
            <View className='space-stats'>
              <Text>{space.workCount} 作品</Text>
              <Text>{space.memberCount} 成员</Text>
            </View>
          </View>
        </View>
      )}

      <View className='slice-bar'>
        {SLICES.map((s) => (
          <Text key={s.key} className={`slice-chip ${slice === s.key ? 'active' : ''}`} onClick={() => switchSlice(s.key)}>{s.label}</Text>
        ))}
      </View>

      <ScrollView scrollY className='timeline'>
        {groups.map(([label, items]) => (
          <View key={label}>
            <View className='group-label'>{label}</View>
            {items.map((p) => <WorkCard key={p.id} projection={p} />)}
          </View>
        ))}
        {!groups.length ? <View className='empty'>该时间片暂无作品</View> : null}
      </ScrollView>

      <View className='fab' onClick={goPublish}>＋</View>

      <View className='section-title member-section-title'>
        <Text>群成员</Text>
        {space && <Text className='invite-member-btn' onClick={() => Taro.navigateTo({ url: `/pages/space-invite/index?spaceId=${space.id}` })}>＋</Text>}
      </View>
      <View className='member-list card'>
        {members.map((m) => (
          <View key={m.id} className='member-item' onClick={() => goMember(m)}>
            <View className='avatar'>
              {m.user.avatarUrl ? <Image src={m.user.avatarUrl} mode='aspectFill' /> : <Text>{initial(m.user.nickname)}</Text>}
            </View>
            <View className='member-name'>
              <Text>{displayName(m.user.nickname)}</Text>
              {m.role === 'owner' ? <Text className='role-tag'>群主</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
