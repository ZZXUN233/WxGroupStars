import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import CommentList from '../../components/CommentList'
import { useApp } from '../../store'
import type { Comment, Projection, Space } from '../../types'
import { dateTime } from '../../utils/format'
import { WORK_TYPE_LABEL } from '../../utils/workType'
import {
  addProjection, createComment, deleteComment, deleteWork, getComments, getMySpaces,
  getProjection, revokeProjection, toggleLike
} from '../../api'
import './index.scss'

export default function WorkDetail() {
  const { user } = useApp()
  const [projection, setProjection] = useState<Projection | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [input, setInput] = useState('')
  const [replyTarget, setReplyTarget] = useState<{ parentId?: number; replyToUserId?: number; label: string } | null>(null)
  const [projectionId, setProjectionId] = useState(0)
  const [spaceId, setSpaceId] = useState(0)

  useLoad((params) => {
    const pid = Number(params?.projectionId || 0)
    setProjectionId(pid)
    setSpaceId(Number(params?.spaceId || 0))
    load(pid)
  })

  useShareAppMessage(() => ({
    title: projection ? `「${projection.work.title}」by ${projection.work.author.nickname}` : '群星闪耀',
    path: `/pages/work-detail/index?projectionId=${projectionId}&spaceId=${spaceId}`
  }))

  const load = async (pid: number) => {
    const [p, c] = await Promise.all([getProjection(pid), getComments(pid)])
    setProjection(p.data)
    setComments(c.data)
  }

  const isAuthor = !!projection && user?.id === projection.work.author.id

  const onLike = async () => {
    if (!projection) return
    const res = await toggleLike(projection.id)
    setProjection({ ...projection, likedByMe: res.data.liked, likeCount: res.data.likeCount })
  }

  const onReply = (c: Comment) => {
    setReplyTarget({ parentId: c.id, replyToUserId: c.user.id, label: `回复 @${c.user.nickname}` })
  }

  const submitComment = async () => {
    const content = input.trim()
    if (!content || !projection) return
    const res = await createComment(projection.id, { content, parentId: replyTarget?.parentId, replyToUserId: replyTarget?.replyToUserId })
    if (replyTarget?.parentId) {
      setComments(comments.map((c) => c.id === replyTarget.parentId ? { ...c, replies: [...c.replies, res.data] } : c))
    } else {
      setComments([...comments, res.data])
    }
    setInput('')
    setReplyTarget(null)
    setProjection({ ...projection, commentCount: projection.commentCount + 1 })
  }

  const onDeleteComment = async (c: Comment) => {
    const r = await Taro.showModal({ title: '删除评论', content: '确定删除这条评论？' })
    if (!r.confirm) return
    await deleteComment(c.id)
    // 父评论或子回复都可能是删除目标，一次遍历同时清理
    setComments((list) => list
      .filter((x) => x.id !== c.id)
      .map((x) => ({ ...x, replies: x.replies.filter((r) => r.id !== c.id) })))
  }

  const onAuthorManage = async () => {
    if (!projection) return
    Taro.showActionSheet({
      itemList: ['编辑作品', '追加到其他群', '撤销在本群投影', '删除作品'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          Taro.navigateTo({ url: `/pages/publish/index?workId=${projection.work.id}` })
        } else if (res.tapIndex === 1) {
          const spaces = (await getMySpaces()).data
          const candidates = spaces.filter((s: Space) => s.id !== projection.spaceId)
          if (!candidates.length) return Taro.showToast({ title: '没有可追加的群', icon: 'none' })
          const pick = await Taro.showActionSheet({ itemList: candidates.map((s) => s.name) })
          if (pick.tapIndex >= 0) {
            const target = candidates[pick.tapIndex]
            await addProjection(projection.work.id, target.id)
            Taro.showToast({ title: `已追加到「${target.name}」`, icon: 'success' })
          }
        } else if (res.tapIndex === 2) {
          const r = await Taro.showModal({ title: '撤销投影', content: '撤销后本群成员将看不到该作品，互动数据软保留。' })
          if (r.confirm) {
            await revokeProjection(projection.id)
            Taro.showToast({ title: '已撤销', icon: 'success' })
            setTimeout(() => Taro.navigateBack(), 500)
          }
        } else if (res.tapIndex === 3) {
          const r = await Taro.showModal({ title: '删除作品', content: '将隐藏该作品全部投影，数据保留。' })
          if (r.confirm) {
            await deleteWork(projection.work.id)
            Taro.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => Taro.navigateBack(), 500)
          }
        }
      }
    })
  }

  const mediaUrls = projection?.work.mediaUrls || []
  const workBody = useMemo(() => {
    const w = projection?.work
    if (!w) return null
    switch (w.type) {
      case 'text':
        return <View className='body-text'>{w.textContent}</View>
      case 'image':
        return (
          <ScrollView scrollX className='image-strip'>
            {mediaUrls.map((url) => <Image key={url} className='strip-img' src={url} mode='widthFix' />)}
          </ScrollView>
        )
      case 'audio_video':
        return <View className='media-box'>🎬 音视频作品（播放器接入 COS 播放地址）</View>
      case 'tech':
        return <View className='tech-box'>{w.techCode}</View>
      case 'external':
        return <View className='external-box'>🔗 {w.externalLink}</View>
    }
  }, [projection])

  if (!projection) return <View className='empty'>加载中…</View>

  const w = projection.work
  return (
    <View className='detail'>
      <ScrollView scrollY className='detail-scroll'>
        <View className='work-head'>
          <View className='work-title'>{w.title}</View>
          <View className='work-meta'>
            <Text className='type-chip'>{WORK_TYPE_LABEL[w.type]}</Text>
            <Text className='time'>{dateTime(projection.projectedAt)}</Text>
            {isAuthor ? <Text className='manage-link' onClick={onAuthorManage}>管理</Text> : null}
          </View>
          <View className='author-line'>
            <View className='avatar avatar-sm'>
              {w.author.avatarUrl ? <Image src={w.author.avatarUrl} mode='aspectFill' /> : null}
              <Text>{w.author.nickname.slice(0, 1)}</Text>
            </View>
            <Text className='author-name' onClick={() => Taro.navigateTo({ url: `/pages/profile/index?userId=${w.author.id}&spaceId=${spaceId}` })}>{w.author.nickname}</Text>
          </View>
        </View>

        {workBody}

        {w.tags?.length ? (
          <View className='tag-row'>{w.tags.map((t) => <Text key={t} className='chip plain'>{t}</Text>)}</View>
        ) : null}

        <View className='action-row'>
          <View className={`action-btn ${projection.likedByMe ? 'liked' : ''}`} onClick={onLike}>
            <Text>{projection.likedByMe ? '❤️' : '🤍'}</Text>
            <Text>{projection.likeCount}</Text>
          </View>
          <View className='action-btn'>
            <Text>💬</Text>
            <Text>{projection.commentCount}</Text>
          </View>
          <Button className='share-btn' openType='share'>分享</Button>
        </View>

        <View className='section-title'>评论</View>
        <CommentList comments={comments} onReply={onReply} onDelete={onDeleteComment} />
      </ScrollView>

      <View className='input-bar'>
        {replyTarget ? (
          <View className='reply-hint'>
            <Text>{replyTarget.label}</Text>
            <Text className='cancel-reply' onClick={() => setReplyTarget(null)}>取消</Text>
          </View>
        ) : null}
        <Input
          className='input-field'
          value={input}
          onInput={(e) => setInput(e.detail.value)}
          confirmType='send'
          onConfirm={submitComment}
          placeholder='说点什么…'
        />
        <Text className={`send-btn ${input.trim() ? '' : 'disabled'}`} onClick={submitComment}>发送</Text>
      </View>
    </View>
  )
}
