import { Button, Image, Input, ScrollView, Text, Video, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import CommentList from '../../components/CommentList'
import Markdown from '../../components/Markdown'
import { useApp } from '../../store'
import type { Comment, Projection, Space } from '../../types'
import { dateTime, displayName, initial } from '../../utils/format'
import { WORK_TYPE_LABEL } from '../../utils/workType'
import {
  addProjection, createComment, deleteComment, deleteWork, getComments, getMySpaces,
  getProjection, revokeProjection, toggleLike
} from '../../api'
import './index.scss'

/** 按 URL 扩展名区分音频/视频（audio_video 类型单媒体） */
const isAudioUrl = (u: string) => /\.(mp3|m4a|wav|aac|flac|ogg)(\?|$)/i.test(u)

/**
 * 网络媒体防盗链兜底：COS 桶拒绝空 Referer 的请求，<video>/createInnerAudioContext 原生播放器的
 * 请求 Referer 不受 JS 控制、真机可能不带 → 403 播不了。改用 Taro.downloadFile 先下载到本地
 * 临时文件（微信会强制注入 servicewechat.com Referer，已在 COS 防盗链白名单内，实测 206），
 * 再播本地路径，绕开防盗链。
 */
function useLocalMedia(url: string | undefined): { src: string; loading: boolean; error: string } {
  const [src, setSrc] = useState(url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!url) {
      setSrc(''); setLoading(false); setError('')
      return
    }
    // 本地文件直接用，无需下载
    if (url.startsWith('wxfile://') || url.startsWith('http://tmp') || url.startsWith('https://tmp')) {
      setSrc(url); setLoading(false); setError('')
      return
    }
    setSrc(''); setLoading(true); setError('')
    Taro.downloadFile({ url, timeout: 30000 })
      .then((res) => {
        if (cancelled) return
        if (res.statusCode === 200) setSrc(res.tempFilePath)
        else setError(`媒体下载失败（${res.statusCode}）`)
      })
      .catch(() => { if (!cancelled) setError('媒体下载失败，请稍后重试') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])

  return { src, loading, error }
}

/** 音频播放器：createInnerAudioContext 编程式播放（微信 audio 组件已废弃） */
function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const ctx = useMemo(() => {
    const c = Taro.createInnerAudioContext()
    c.src = src
    c.onEnded(() => setPlaying(false))
    c.onError(() => setPlaying(false))
    return c
  }, [src])

  useEffect(() => () => ctx.destroy(), [ctx])

  const toggle = () => {
    if (playing) {
      ctx.pause()
      setPlaying(false)
    } else {
      ctx.play()
      setPlaying(true)
    }
  }

  return (
    <View className='audio-player' onClick={toggle}>
      <Text className='audio-icon'>{playing ? '⏸' : '▶️'}</Text>
      <View className='audio-meta'>
        <Text className='audio-title'>{playing ? '播放中…' : '点击播放音频'}</Text>
        <Text className='audio-sub'>{src.split('/').pop()}</Text>
      </View>
    </View>
  )
}

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
    title: projection ? `「${projection.work.title}」by ${displayName(projection.work.author.nickname)}` : '群星闪耀',
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
    setReplyTarget({ parentId: c.id, replyToUserId: c.user.id, label: `回复 @${displayName(c.user.nickname)}` })
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
  const rawMedia = projection?.work.type === 'audio_video' ? mediaUrls[0] : undefined
  const { src: localMedia, loading: mediaLoading, error: mediaError } = useLocalMedia(rawMedia)
  const workBody = useMemo(() => {
    const w = projection?.work
    if (!w) return null
    switch (w.type) {
      case 'text':
        // 文字正文走 Markdown 渲染（标题/列表/代码块等，Markdown 组件）
        return <Markdown content={w.textContent || ''} />
      case 'image':
        return (
          <ScrollView scrollX className='image-strip'>
            {mediaUrls.map((url) => <Image key={url} className='strip-img' src={url} mode='widthFix' />)}
          </ScrollView>
        )
      case 'audio_video':
        if (!rawMedia) return <View className='media-box'>未找到媒体文件</View>
        if (mediaLoading) return <View className='media-box'>媒体加载中…</View>
        if (mediaError) return <View className='media-box'>⚠️ {mediaError}</View>
        return isAudioUrl(rawMedia) ? <AudioPlayer src={localMedia} /> : <Video className='detail-video' src={localMedia} controls />
      case 'tech':
        return <View className='tech-box'>{w.techCode}</View>
      case 'external':
        return <View className='external-box'>🔗 {w.externalLink}</View>
    }
  }, [projection, localMedia, mediaLoading, mediaError])

  if (!projection) return <View className='empty'>加载中…</View>

  const w = projection.work
  return (
    <View className='detail'>
      <ScrollView scrollY className='detail-scroll'>
        <View className='work-head'>
          <View className='work-title-row'>
            <View className='work-title'>{w.title}</View>
            {isAuthor ? <Text className='manage-link' onClick={onAuthorManage}>管理</Text> : null}
          </View>
          <View className='work-meta'>
            <Text className='type-chip'>{WORK_TYPE_LABEL[w.type]}</Text>
            <View className='meta-time'><Text className='time'>{dateTime(projection.projectedAt)}</Text></View>
          </View>
          <View className='author-line'>
            <View className='avatar avatar-sm'>
              {w.author.avatarUrl ? <Image src={w.author.avatarUrl} mode='aspectFill' /> : <Text>{initial(w.author.nickname)}</Text>}
            </View>
            <Text className='author-name' onClick={() => Taro.navigateTo({ url: `/pages/profile/index?userId=${w.author.id}&spaceId=${spaceId}` })}>{displayName(w.author.nickname)}</Text>
          </View>
        </View>

        {/* 非图片类型的封面展示（图片类型首图已在主体滚动条中） */}
        {w.coverUrl && w.type !== 'image' ? <Image className='detail-cover' src={w.coverUrl} mode='widthFix' /> : null}

        {workBody}

        {/* 全类型内容说明（文字类型即正文已渲染，其余在主体下方展示介绍/心得） */}
        {w.type !== 'text' && w.textContent ? (
          <View className='body-desc'>
            <View className='section-title'>说明</View>
            <Markdown content={w.textContent} />
          </View>
        ) : null}

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
          <Button className='share-btn' openType='share'>📤 分享</Button>
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
