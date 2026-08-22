import { Button, Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import WorkCard from '../../components/WorkCard'
import type { Member, Projection, Space, TimelineSlice } from '../../types'
import { getMemberRequests, getSpaceAccessInfo, getSpaceDetail, getSpaceMembers, getSpaceTimeline, joinSpace, leaveSpace, removeSpaceMember, reviewMember, setSpaceAdmin, transferOwner, updateSpace } from '../../api'
import { displayName, initial } from '../../utils/format'
import type { SpaceAccessInfo } from '../../types'
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
  const [pendingMembers, setPendingMembers] = useState<Member[]>([])
  const [memberTab, setMemberTab] = useState<'members' | 'pending'>('members')
  const [accessInfo, setAccessInfo] = useState<SpaceAccessInfo | null>(null)
  const [applying, setApplying] = useState(false)
  const [slice, setSlice] = useState<TimelineSlice>('month')
  const [timeline, setTimeline] = useState<Projection[]>([])

  useLoad((params) => {
    const id = Number(params?.id || 0)
    setSpaceId(id)
    load(id)
  })

  const load = async (id: number, sl = 'month' as TimelineSlice) => {
    let sp
    try {
      sp = await getSpaceDetail(id)
    } catch {
      const access = await getSpaceAccessInfo(id)
      setAccessInfo(access.data)
      Taro.setNavigationBarTitle({ title: access.data.space.name })
      return
    }
    const [mem, tl] = await Promise.all([
      getSpaceMembers(id),
      getSpaceTimeline(id, sl)
    ])
    setSpace(sp.data)
    setAccessInfo(null)
    setMembers(mem.data)
    setTimeline(tl.data.items)
    Taro.setNavigationBarTitle({ title: sp.data.name })
  }

  const applyForAccess = async () => {
    if (!accessInfo || applying) return
    setApplying(true)
    try {
      const result = await joinSpace(accessInfo.space.id)
      if (result.data.state === 'active') {
        await load(accessInfo.space.id)
        Taro.showToast({ title: '已加入群空间', icon: 'success' })
      } else {
        setAccessInfo({ ...accessInfo, state: result.data.state })
        Taro.showToast({ title: '申请已提交', icon: 'success' })
      }
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '申请失败，请重试', icon: 'none' })
    } finally {
      setApplying(false)
    }
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

  const loadPendingMembers = async () => {
    if (!space) return
    const requests = await getMemberRequests(space.id)
    setPendingMembers(requests.data)
  }

  const reviewRequest = async (request: Member, approved: boolean) => {
    if (!space) return
    await reviewMember(space.id, request.id, approved)
    setPendingMembers((list) => list.filter((item) => item.id !== request.id))
    Taro.showToast({ title: approved ? '已通过' : '已拒绝', icon: 'success' })
  }

  const manageMember = (member: Member) => {
    if (!space || space.myRole !== 'owner' || member.role === 'owner') return
    const isAdmin = member.role === 'admin'
    Taro.showActionSheet({ itemList: [isAdmin ? '撤销管理员' : '设为管理员', '踢出群空间'] }).then(async (result) => {
      if (result.tapIndex === 0) {
        await setSpaceAdmin(space.id, member.user.id, !isAdmin)
        setMembers((list) => list.map((item) => item.id === member.id ? { ...item, role: isAdmin ? 'member' : 'admin' } : item))
        Taro.showToast({ title: isAdmin ? '已撤销管理员' : '已设为管理员', icon: 'success' })
      } else if (result.tapIndex === 1) {
        const confirmed = await Taro.showModal({ title: '踢出成员', content: `确定将${displayName(member.user.nickname)}移出群空间吗？` })
        if (confirmed.confirm) {
          await removeSpaceMember(space.id, member.user.id)
          setMembers((list) => list.filter((item) => item.id !== member.id))
          Taro.showToast({ title: '已移出群空间', icon: 'success' })
        }
      }
    }).catch(() => undefined)
  }

  const leaveCurrentSpace = async () => {
    if (!space || space.myRole === 'owner') return
    const confirmed = await Taro.showModal({ title: '退出群空间', content: '退出后将无法查看群内作品，确定退出吗？' })
    if (!confirmed.confirm) return
    await leaveSpace(space.id)
    Taro.showToast({ title: '已退出', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 500)
  }

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
      fail: () => undefined,
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
          const pick = await Taro.showActionSheet({ itemList: idx, fail: () => undefined })
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

  if (!space && accessInfo) {
    const stateText = accessInfo.state === 'pending'
      ? '申请审核中'
      : accessInfo.state === 'rejected'
        ? '申请未通过，可再次申请'
        : '你暂无该群空间权限'
    return (
      <View className='space access-page'>
        <View className='access-card'>
          <View className='access-space-head'>
            <View className='space-cover'>{accessInfo.space.coverUrl ? <Image src={accessInfo.space.coverUrl} mode='aspectFill' /> : <Text className='space-emoji'>⭐</Text>}</View>
            <View>
              <Text className='access-space-title'>{accessInfo.space.name}</Text>
              <Text className='access-state'>{stateText}</Text>
            </View>
          </View>
          <View className='access-divider' />
          <View className='owner-row'>
            <View className='avatar'>
              {accessInfo.owner.avatarUrl ? <Image src={accessInfo.owner.avatarUrl} mode='aspectFill' /> : <Text>{initial(accessInfo.owner.nickname)}</Text>}
            </View>
            <View className='owner-info'>
              <Text className='owner-label'>群主</Text>
              <Text className='owner-name'>{displayName(accessInfo.owner.nickname)}</Text>
            </View>
            <Text className='owner-info-icon'>i</Text>
          </View>
          {accessInfo.state !== 'pending' ? (
            <View className={`apply-btn ${applying ? 'disabled' : ''}`} onClick={applyForAccess}>申请加入</View>
          ) : null}
        </View>
      </View>
    )
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
        {space && <View className='member-actions'>
          {space.myRole !== 'owner' ? <Text className='member-action-btn' onClick={leaveCurrentSpace}>退出</Text> : null}
          <Text className='member-action-btn invite-member-btn' onClick={() => Taro.navigateTo({ url: `/pages/space-invite/index?spaceId=${space.id}` })}>＋ 邀请成员</Text>
        </View>}
      </View>
      {canManage ? (
        <View className='member-tabs'>
          <Text className={`member-tab ${memberTab === 'members' ? 'active' : ''}`} onClick={() => setMemberTab('members')}>正式成员</Text>
          <Text className={`member-tab ${memberTab === 'pending' ? 'active' : ''}`} onClick={() => { setMemberTab('pending'); loadPendingMembers() }}>待审核 {space.pendingCount ? `(${space.pendingCount})` : ''}</Text>
        </View>
      ) : null}
      <View className='member-list card'>
        {(memberTab === 'pending' && canManage ? pendingMembers : members).map((m) => (
          <View key={m.id} className='member-item' onClick={() => memberTab === 'members' && goMember(m)}>
            <View className='avatar'>
              {m.user.avatarUrl ? <Image src={m.user.avatarUrl} mode='aspectFill' /> : <Text>{initial(m.user.nickname)}</Text>}
            </View>
            <View className='member-name'>
              <Text>{displayName(m.user.nickname)}</Text>
              {m.role === 'owner' ? <Text className='role-tag'>群主</Text> : null}
              {m.role === 'admin' ? <Text className='role-tag'>管理员</Text> : null}
            </View>
            {memberTab === 'pending' && canManage ? (
              <View className='request-actions'>
                <Text className='request-btn approve' onClick={(event) => { event.stopPropagation(); reviewRequest(m, true) }}>通过</Text>
                <Text className='request-btn reject' onClick={(event) => { event.stopPropagation(); reviewRequest(m, false) }}>拒绝</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}
