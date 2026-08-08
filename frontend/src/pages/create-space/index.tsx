import { Input, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { createSpace, joinSpace } from '../../api'
import './index.scss'

export default function CreateSpace() {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [joinMode, setJoinMode] = useState(false)
  const [joinedName, setJoinedName] = useState('')

  // 群分享卡片打开 → ADR-0008 加入路径（mock：直接成功）
  useLoad(async (params) => {
    const targetId = Number(params?.spaceId || 0)
    if (targetId) {
      setJoinMode(true)
      const res = await joinSpace(targetId)
      setJoinedName(res.data.name)
    }
  })

  const submit = async () => {
    if (submitting) return
    if (!name.trim()) return Taro.showToast({ title: '请填写群空间名称', icon: 'none' })
    setSubmitting(true)
    try {
      await createSpace({ name: name.trim() })
      Taro.showToast({ title: '已创建', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } finally {
      setSubmitting(false)
    }
  }

  if (joinMode) {
    return (
      <View className='create-space'>
        <View className='join-card card'>
          <Text className='join-emoji'>🎉</Text>
          <Text className='join-title'>已加入「{joinedName}」</Text>
          <Text className='join-sub'>通过群分享卡片加入的群空间已显示在首页</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='create-space'>
      <View className='field'>
        <Text className='field-label'>群空间名称</Text>
        <Input className='field-input' value={name} onInput={(e) => setName(e.detail.value)} placeholder='例如：AI 创造交流群' maxlength={20} />
      </View>
      <View className='create-hint'>创建后你就是该群空间的发起人，可转让管理权给其他成员。</View>
      <View className={`btn primary submit ${submitting ? 'disabled' : ''}`} onClick={submit}>创建群空间</View>
    </View>
  )
}
