/**
 * 编辑资料 —— 微信「头像昵称填写」能力（ADR-0017）
 * code2session 登录不返回昵称头像，须用户主动授权：button open-type="chooseAvatar" 选头像、
 * input type="nickname" 昵称键盘一键填入最新微信昵称。两者一并 PATCH /auth/profile 保存，
 * 随时可更新（微信昵称变更后再次同步即可）；头像临时文件先直传 COS（ADR-0005）。
 */
import { Button, Image, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { useApp } from '../../store'
import { COS_BASE_URL, getMe, getPresign, updateProfile, uploadToCos } from '../../api'
import { initial } from '../../utils/format'
import './index.scss'

/** 本地临时文件：wxfile:// 或 http(s)://tmp 开头；COS 完整 URL 视为已上传对象（编辑回填） */
const isLocalFile = (p: string) => p.startsWith('wxfile://') || p.startsWith('http://tmp') || p.startsWith('https://tmp')
/** 从路径提取文件名（带扩展名），临时路径无扩展名时用 fallback 兜底 */
const fileNameOf = (p: string, fallbackExt: string) => {
  const seg = (p.split('/').pop() || '').split('?')[0]
  return /\.[a-z0-9]+$/i.test(seg) ? seg : `file.${fallbackExt}`
}

export default function EditProfile() {
  const { refreshUser } = useApp()
  const [nickname, setNickname] = useState('')
  const [focusInput, setFocusInput] = useState(false) // 昵称输入态：点击才弹出微信昵称键盘，填入即收起
  const [avatar, setAvatar] = useState('') // 当前头像（选新头像时为本地临时路径）
  const [dirtyAvatar, setDirtyAvatar] = useState(false) // 是否选了新头像待上传
  const [saving, setSaving] = useState(false)

  useDidShow(async () => {
    // 每次进入拉取后端最新资料，避免展示缓存的旧昵称/头像
    try {
      const res = await getMe()
      setNickname(res.data.nickname || '')
      setAvatar(res.data.avatarUrl || '')
    } catch {
      // 拉取失败保持现状
    }
  })

  const onChooseAvatar = (e: { detail: { avatarUrl: string } }) => {
    setAvatar(e.detail.avatarUrl)
    setDirtyAvatar(true)
  }

  const save = async () => {
    if (saving) return
    const name = nickname.trim()
    if (!name) return Taro.showToast({ title: '请先填入微信昵称', icon: 'none' })
    setSaving(true)
    try {
      // 新选的头像直传 COS，落库完整 URL；未改头像则沿用原 URL
      let avatarUrl = avatar
      if (dirtyAvatar && isLocalFile(avatar)) {
        const presign = (await getPresign(fileNameOf(avatar, 'jpg'))).data
        await uploadToCos(avatar, presign)
        avatarUrl = `${COS_BASE_URL}/${presign.key}`
      }
      const saved = await updateProfile({ nickname: name, avatarUrl })
      if (saved.data.nickname !== name || saved.data.avatarUrl !== avatarUrl) {
        throw new Error('后端返回的用户资料未生效')
      }
      await refreshUser() // 刷新全局用户态（星轨页、首页作者展示）
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack({ delta: 1 }), 500)
    } catch (err) {
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '保存失败，请重试'
      Taro.showToast({ title: message.slice(0, 32), icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='edit-profile'>
      <View className='avatar-field'>
        <Button className='avatar-btn' open-type='chooseAvatar' onChooseAvatar={onChooseAvatar}>
          <View className='avatar avatar-lg'>
            {avatar ? <Image src={avatar} mode='aspectFill' /> : <Text>{initial(nickname)}</Text>}
          </View>
          <Text className='avatar-hint'>点击更换头像</Text>
        </Button>
      </View>

      <View className='field'>
        <Text className='field-label'>昵称</Text>
        {focusInput ? (
          <Input
            className='field-input'
            type='nickname'
            focus
            value={nickname}
            onInput={(e) => {
              const v = e.detail.value
              setNickname(v)
              if (v) setFocusInput(false) // 填入即收起键盘：昵称只接受微信昵称键盘的一次性填入，不提供持续输入
            }}
            onBlur={() => setFocusInput(false)}
            maxlength={20}
          />
        ) : (
          <View className='nickname-btn' onClick={() => setFocusInput(true)}>
            <Text className={`nickname-btn-text ${nickname ? '' : 'placeholder'}`}>{nickname || '点击同步微信昵称'}</Text>
            <Text className='nickname-btn-arrow'>✎</Text>
          </View>
        )}
        <View className='field-hint'>昵称来自微信：点击后弹出微信昵称键盘，点「微信昵称」一键填入，不可手动输入。</View>
      </View>

      <View className={`btn primary submit ${saving ? 'disabled' : ''}`} onClick={save}>保存</View>
    </View>
  )
}
