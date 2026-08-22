import { Button, Text, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { acceptSpaceInvite, createSpaceInvite } from '../../api'
import type { Space } from '../../types'
import './index.scss'

export default function SpaceInvite() {
  const [spaceId, setSpaceId] = useState(0)
  const [space, setSpace] = useState<Pick<Space, 'id' | 'name'> | null>(null)
  const [token, setToken] = useState('')
  const [accepted, setAccepted] = useState(false)

  useLoad(async (params) => {
    const inviteToken = params?.token
    if (inviteToken) {
      const result = await acceptSpaceInvite(inviteToken)
      setAccepted(result.data.state === 'active')
      if (result.data.space) setSpace({ id: result.data.space.id, name: result.data.space.name })
      Taro.setNavigationBarTitle({ title: '加入群空间' })
      return
    }
    const id = Number(params?.spaceId || 0)
    setSpaceId(id)
    const result = await createSpaceInvite(id)
    setToken(result.data.token)
    setSpace(result.data.space)
    Taro.setNavigationBarTitle({ title: '邀请成员' })
  })

  useShareAppMessage(() => ({
    title: space ? `邀请你加入「${space.name}」` : '邀请你加入群空间',
    path: `/pages/space-invite/index?token=${token}`,
  }))

  if (accepted) {
    return <View className='invite-page'><Text className='invite-title'>已加入「{space?.name}」</Text><Text className='invite-sub'>现在可以查看群空间内容了</Text><Button onClick={() => Taro.reLaunch({ url: `/pages/space/index?id=${space?.id}` })}>进入群空间</Button></View>
  }

  return (
    <View className='invite-page'>
      <Text className='invite-title'>邀请成员</Text>
      <Text className='invite-sub'>邀请链接 24 小时内有效，且仅可使用一次</Text>
      <Button className='share-invite-btn' openType='share' disabled={!token}>转发给微信联系人</Button>
      {spaceId ? <Text className='invite-note'>对方点击链接后将自动加入「{space?.name || ''}」</Text> : null}
    </View>
  )
}
