import { Button, Image, Input, ScrollView, Text, Textarea, Video, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import CommentList from '../../components/CommentList'
import Markdown from '../../components/Markdown'
import { useApp } from '../../store'
import type { Comment, Projection, WorkDetail } from '../../types'
import { dateTime, displayName, initial } from '../../utils/format'
import { WORK_TYPE_LABEL } from '../../utils/workType'
import {
  addProjection, createComment, deleteComment, deleteWork, getComments, getMySpaces,
  getProjection, getWork, revokeProjection, toggleLike
} from '../../api'
import './index.scss'

/** 按 URL 扩展名区分音频/视频（audio_video 类型单媒体） */
const isAudioUrl = (u: string) => /\.(mp3|m4a|wav|aac|flac|ogg)(\?|$)/i.test(u)

/** 秒数格式化为 mm:ss */
const formatTime = (s: number): string => {
  if (!Number.isFinite(s) || s <= 0) return '00:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * 音频/视频播放源（COS 已放开防盗链，默认直连网络 URL，由原生播放器直接加载）。
 * enabled=false：直接用 url 作为播放源（直连）。
 * enabled=true：直连失败后的兜底——Taro.downloadFile 下载到本地临时文件再播。
 *   历史上 COS 防盗链拒绝空 Referer、原生播放器 403，downloadFile 会注入
 *   servicewechat.com Referer（白名单内）才能下载；现在仅个别设备/兼容性场景启用。
 */
function useLocalMedia(url: string | undefined, enabled = true): { src: string; loading: boolean; error: string; progress: number } {
  const [src, setSrc] = useState(url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!url) {
      setSrc(''); setLoading(false); setError(''); setProgress(0)
      return
    }
    if (!enabled) {
      setSrc(url); setLoading(false); setError(''); setProgress(100)
      return
    }
    // 本地文件直接用，无需下载
    if (url.startsWith('wxfile://') || url.startsWith('http://tmp') || url.startsWith('https://tmp')) {
      setSrc(url); setLoading(false); setError(''); setProgress(100)
      return
    }
    setSrc(''); setLoading(true); setError(''); setProgress(0)

    const downloadTask = Taro.downloadFile({
      url,
      timeout: 60000,
      success: (res) => {
        if (cancelled) return
        if (res.statusCode === 200) setSrc(res.tempFilePath)
        else setError(`媒体下载失败（${res.statusCode}）`)
      },
      fail: () => { if (!cancelled) setError('媒体下载失败，请稍后重试') },
      complete: () => { if (!cancelled) setLoading(false) }
    })

    // 监听下载进度
    downloadTask.onProgressUpdate((res) => {
      if (!cancelled) setProgress(res.progress)
    })

    return () => { cancelled = true }
  }, [url, enabled])

  return { src, loading, error, progress }
}

/** 音频播放器：createInnerAudioContext 编程式播放（微信 audio 组件已废弃），带进度条/时间/点击跳转 */
function AudioPlayer({ src, onError }: { src: string; onError?: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const ctx = useMemo(() => {
    const c = Taro.createInnerAudioContext()
    c.src = src
    c.onCanplay(() => {
      if (c.duration && Number.isFinite(c.duration)) setDuration(c.duration)
    })
    c.onTimeUpdate(() => {
      setCurrentTime(c.currentTime || 0)
      if (c.duration && Number.isFinite(c.duration)) setDuration(c.duration)
    })
    c.onEnded(() => { setPlaying(false); setCurrentTime(0) })
    c.onError(() => { setPlaying(false); onError?.() })
    return c
  }, [src, onError])

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

  // 点击进度条跳转：用触摸点页面坐标与进度条位置计算比例后 seek
  const seekTo = (e: any) => {
    e.stopPropagation?.()
    if (!duration) return
    const touchX = e.detail?.x ?? e.changedTouches?.[0]?.pageX ?? e.touches?.[0]?.pageX
    if (touchX == null) return
    Taro.createSelectorQuery()
      .select('.audio-progress-track')
      .boundingClientRect((rect: any) => {
        if (!rect || !rect.width) return
        const ratio = Math.min(1, Math.max(0, (touchX - rect.left) / rect.width))
        const target = ratio * duration
        ctx.seek(target)
        setCurrentTime(target)
      })
      .exec()
  }

  const percent = duration ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <View className='audio-player'>
      <View className='audio-main' onClick={toggle}>
        <Text className='audio-icon'>{playing ? '⏸' : '▶️'}</Text>
        <View className='audio-meta'>
          <Text className='audio-title'>{playing ? '播放中…' : '点击播放音频'}</Text>
          <Text className='audio-sub'>{src.split('/').pop()}</Text>
        </View>
      </View>
      <View className='audio-progress-track' onClick={seekTo}>
        <View className='audio-progress-fill' style={{ width: `${percent}%` }} />
      </View>
      <View className='audio-times'>
        <Text className='audio-time'>{formatTime(currentTime)}</Text>
        <Text className='audio-time'>{duration ? formatTime(duration) : '--:--'}</Text>
      </View>
    </View>
  )
}

export default function WorkDetail() {
  const { user } = useApp()
  const [projection, setProjection] = useState<Projection | null>(null)
  const [workDetail, setWorkDetail] = useState<WorkDetail | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [input, setInput] = useState('')
  const [commentFullscreen, setCommentFullscreen] = useState(false)
  const [replyTarget, setReplyTarget] = useState<{ parentId?: number; replyToUserId?: number; label: string } | null>(null)
  const [projectionId, setProjectionId] = useState(0)
  const [spaceId, setSpaceId] = useState(0)
  const [workId, setWorkId] = useState(0)
  const [pageError, setPageError] = useState('')

  useLoad((params) => {
    const pid = Number(params?.projectionId || 0)
    const wid = Number(params?.workId || 0)
    setProjectionId(pid)
    setSpaceId(Number(params?.spaceId || 0))
    setWorkId(wid)
    if (pid) {
      load(pid)
    } else if (wid) {
      loadWorkOnly(wid)
    }
  })

  useShareAppMessage(() => ({
    title: projection ? `「${projection.work.title}」by ${displayName(projection.work.author.nickname)}` : workDetail ? `「${workDetail.title}」by ${displayName(workDetail.author.nickname)}` : '群星闪耀',
    path: projectionId ? `/pages/work-detail/index?projectionId=${projectionId}&spaceId=${spaceId}` : `/pages/work-detail/index?workId=${workId}&spaceId=${spaceId}`
  }))

  const load = async (pid: number) => {
    try {
      const p = await getProjection(pid)
      const [c, w] = await Promise.all([getComments(pid), getWork(p.data.work.id)])
      setProjection(p.data)
      setComments(c.data)
      setWorkDetail(w.data)
    } catch (err) {
      const msg = (err as { message?: string }).message || '加载失败'
      setPageError(msg)
    }
  }

  // 仅加载作品信息（无投影）
  const loadWorkOnly = async (wid: number) => {
    try {
      const w = await getWork(wid)
      setWorkDetail(w.data)
    } catch (err) {
      const msg = (err as { message?: string }).message || '加载失败'
      setPageError(msg)
    }
  }

  const isAuthor = (projection && user?.id === projection.work.author.id) || (workDetail && user?.id === workDetail.author.id)

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
      .map((x) => ({ ...x, replies: x.replies.filter((rep) => rep.id !== c.id) })))
  }

  const onAuthorManage = async () => {
    const work = projection?.work || workDetail
    if (!work) return

    const itemList = ['编辑作品', '管理投影', '删除作品']

    Taro.showActionSheet({
      itemList,
      fail: () => undefined,
      success: async (res) => {
        if (res.tapIndex === 0) {
          // 编辑作品
          Taro.navigateTo({ url: `/pages/publish/index?workId=${work.id}` })
        } else if (res.tapIndex === 1) {
          // 管理投影
          await manageProjections(work.id)
        } else if (res.tapIndex === 2) {
          // 删除作品
          const r = await Taro.showModal({ title: '删除作品', content: '将隐藏该作品全部投影，数据保留。' })
          if (r.confirm) {
            await deleteWork(work.id)
            Taro.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => Taro.navigateBack(), 500)
          }
        }
      }
    })
  }

  // 管理投影：显示作品在哪些群有投影，支持勾选/取消
  const manageProjections = async (targetWorkId: number) => {
    const spaces = (await getMySpaces()).data
    if (!spaces.length) return Taro.showToast({ title: '请先加入一个群', icon: 'none' })

    // 获取作品当前的投影列表
    const workDetailRes = await getWork(targetWorkId)
    const projectedSpaceIds = new Set(workDetailRes.data.projectedSpaces.map(s => s.id))

    // 构建选项列表，显示每个群的投影状态
    const options = spaces.map(s => ({
      name: s.name,
      id: s.id,
      checked: projectedSpaceIds.has(s.id)
    }))

    // 显示选择界面
    const items = options.map(o => `${o.checked ? '✅' : '⬜'} ${o.name}`)
    const pick = await Taro.showActionSheet({ itemList: items, fail: () => undefined })

    if (pick.tapIndex >= 0) {
      const selected = options[pick.tapIndex]
      if (selected.checked) {
        // 已投影，撤销投影（projectedSpaces 已带 projectionId，撤销该群对应的投影）
        const r = await Taro.showModal({
          title: '撤销投影',
          content: `确定撤销在「${selected.name}」的投影吗？`
        })
        if (r.confirm) {
          const projectionToRevoke = workDetailRes.data.projectedSpaces.find(s => s.id === selected.id)
          if (projectionToRevoke) {
            await revokeProjection(projectionToRevoke.projectionId)
            Taro.showToast({ title: '已撤销', icon: 'success' })
            // 刷新页面
            if (targetWorkId) loadWorkOnly(targetWorkId)
            else if (projectionId) load(projectionId)
          }
        }
      } else {
        // 未投影，添加投影
        await addProjection(targetWorkId, selected.id)
        Taro.showToast({ title: `已投影到「${selected.name}」`, icon: 'success' })
        // 刷新页面
        if (targetWorkId) loadWorkOnly(targetWorkId)
        else if (projectionId) load(projectionId)
      }
    }
  }

  const currentWork = projection?.work || workDetail
  const mediaUrls = currentWork?.mediaUrls || []
  const rawMedia = currentWork?.type === 'audio_video' ? mediaUrls[0] : undefined
  // COS 已放开防盗链：媒体默认直连加载；直连失败（个别设备/兼容性）才下载到本地兜底
  const [mediaNeedsDownload, setMediaNeedsDownload] = useState(false)
  const onMediaError = useCallback(() => setMediaNeedsDownload(true), [])
  const { src: mediaSrc, loading: mediaLoading, error: mediaError, progress: mediaProgress } = useLocalMedia(rawMedia, mediaNeedsDownload)

  // 外链复制：小程序无法直接唤起系统浏览器，复制后引导用户到浏览器打开
  const copyExternalLink = () => {
    const link = currentWork?.externalLink
    if (!link) return
    Taro.setClipboardData({
      data: link,
      success: () => {
        Taro.showModal({
          title: '链接已复制',
          content: '小程序内无法直接打开外部浏览器，请打开手机浏览器（Safari / Chrome 等）粘贴链接访问。',
          showCancel: false,
          confirmText: '知道了',
        })
      }
    })
  }

  // 渲染作品内容
  const renderWorkBody = () => {
    const w = currentWork
    if (!w) return null
    switch (w.type) {
      case 'text':
        return <Markdown content={w.textContent || ''} />
      case 'image':
        return (
          <ScrollView scrollX className='image-strip'>
            {mediaUrls.map((url) => <Image key={url} className='strip-img' src={url} mode='widthFix' />)}
          </ScrollView>
        )
      case 'audio_video':
        if (!rawMedia) return <View className='media-box'>未找到媒体文件</View>
        if (mediaLoading) return (
          <View className='media-box'>
            <View className='download-progress'>
              <View className='download-progress-text'>媒体加载中… {mediaProgress}%</View>
              <View className='download-progress-bar'>
                <View className='download-progress-fill' style={{ width: `${mediaProgress}%` }} />
              </View>
            </View>
          </View>
        )
        if (mediaError) return <View className='media-box'>⚠️ {mediaError}</View>
        return isAudioUrl(rawMedia)
          ? <AudioPlayer src={mediaSrc} onError={onMediaError} />
          : <Video className='detail-video' src={mediaSrc} controls onError={onMediaError} />
      case 'tech':
        return <View className='tech-box'>{w.techCode}</View>
      case 'external':
        return (
          <View className='external-box'>
            <View className='external-link' onClick={copyExternalLink}>🔗 {w.externalLink}</View>
            <View className='external-copy-btn' onClick={copyExternalLink}>复制链接</View>
          </View>
        )
    }
  }

  // 使用 projection 或 workDetail 中的工作信息（都未加载完成时显示加载中）
  const w = projection?.work || workDetail
  if (pageError) {
    return (
      <View className='empty'>
        <Text>{pageError}</Text>
        <View className='btn' style={{ marginTop: '24px' }} onClick={() => Taro.navigateBack()}>返回上一页</View>
      </View>
    )
  }
  if (!w) return <View className='empty'>加载中…</View>
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
            <View className='meta-time'><Text className='time'>{dateTime(projection?.projectedAt || w.createdAt)}</Text></View>
          </View>
          <View className='author-line'>
            <View className='avatar avatar-sm'>
              {w.author.avatarUrl ? <Image src={w.author.avatarUrl} mode='aspectFill' /> : <Text>{initial(w.author.nickname)}</Text>}
            </View>
            <Text className='author-name' onClick={() => Taro.navigateTo({ url: `/pages/profile/index?userId=${w.author.id}&spaceId=${spaceId}` })}>{displayName(w.author.nickname)}</Text>
          </View>
          {workDetail?.projectedSpaces.length ? (
            <View className='projected-spaces'>
              <Text className='projected-spaces-label'>已投影至</Text>
              <Text className='projected-spaces-names'>{workDetail.projectedSpaces.map((space) => space.name).join('、')}</Text>
            </View>
          ) : null}
        </View>

        {/* 非图片类型的封面展示（图片类型首图已在主体滚动条中） */}
        {w.coverUrl && w.type !== 'image' ? <Image className='detail-cover' src={w.coverUrl} mode='widthFix' /> : null}

        {renderWorkBody()}

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
          {projection ? (
            <>
              <View className={`action-btn ${projection.likedByMe ? 'liked' : ''}`} onClick={onLike}>
                <Text>{projection.likedByMe ? '❤️' : '🤍'}</Text>
                <Text>{projection.likeCount}</Text>
              </View>
              <View className='action-btn'>
                <Text>💬</Text>
                <Text>{projection.commentCount}</Text>
              </View>
            </>
          ) : null}
          <Button className='share-btn' openType='share'>📤 分享</Button>
        </View>

        {projection ? (
          <>
            <View className='section-title'>评论</View>
            <CommentList comments={comments} onReply={onReply} onDelete={onDeleteComment} />
          </>
        ) : (
          <View className='empty'>投影到群后可查看和发表评论</View>
        )}
      </ScrollView>

      {commentFullscreen ? (
        <View className='comment-editor half-screen'>
          <View className='comment-editor-head'>
            <Text className='comment-editor-title'>{replyTarget ? replyTarget.label : '发表评论'}</Text>
            <Text className='comment-editor-close' onClick={() => setCommentFullscreen(false)}>关闭</Text>
          </View>
          <Textarea
            className='comment-textarea'
            value={input}
            focus
            autoHeight={false}
            maxlength={2000}
            onInput={(e) => setInput(e.detail.value)}
            placeholder='说点什么…'
          />
          <View className='comment-editor-actions'>
            {replyTarget ? <Text className='comment-cancel-reply' onClick={() => setReplyTarget(null)}>取消回复</Text> : <View />}
            <Text className={`comment-send ${input.trim() ? '' : 'disabled'}`} onClick={async () => { await submitComment(); setCommentFullscreen(false) }}>发送</Text>
          </View>
        </View>
      ) : null}

      <View className='input-bar'>
        {replyTarget ? (
          <View className='reply-hint'>
            <Text>{replyTarget.label}</Text>
            <Text className='cancel-reply' onClick={() => setReplyTarget(null)}>取消</Text>
          </View>
        ) : null}
        <View className='input-row'>
          <Input
            className='input-field'
            value={input}
            onClick={() => setCommentFullscreen(true)}
            onInput={(e) => setInput(e.detail.value)}
            confirmType='send'
            onConfirm={submitComment}
            placeholder='说点什么…'
          />
          <Text className='expand-comment' onClick={() => setCommentFullscreen(true)}>展开</Text>
          <Text className={`send-btn ${input.trim() ? '' : 'disabled'}`} onClick={submitComment}>发送</Text>
        </View>
      </View>
    </View>
  )
}
