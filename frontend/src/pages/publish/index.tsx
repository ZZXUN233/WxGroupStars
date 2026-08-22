import { Image, Input, Text, Textarea, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import Markdown from '../../components/Markdown'
import type { Space, UpsertWorkInput, WorkType } from '../../types'
import { COS_BASE_URL, editWork, getMySpaces, getPresign, getWork, publishWork, uploadToCos } from '../../api'
import { reportClientError } from '../../api/http'
import { WORK_TYPE_EMOJI, WORK_TYPE_LABEL } from '../../utils/workType'
import './index.scss'

const TYPES: WorkType[] = ['text', 'image', 'audio_video', 'tech', 'external']
const MD_HINT = '支持 Markdown：**加粗**、*斜体*、`行内代码`、# 标题、- 列表、> 引用、```代码块```、[链接](https://…)'

/** 本地临时文件：wxfile:// 或 http(s)://tmp 开头；COS 完整 URL 视为已上传对象（编辑回填） */
const isLocalFile = (p: string) => p.startsWith('wxfile://') || p.startsWith('http://tmp') || p.startsWith('https://tmp')
/** COS 完整 URL → object key（避免编辑时把 URL 当 key 重复拼接） */
const keyOfUrl = (p: string) => (p.startsWith(COS_BASE_URL) ? p.slice(COS_BASE_URL.length + 1) : p)
/** 从路径提取文件名（带扩展名），临时路径无扩展名时用 fallback 兜底 */
const fileNameOf = (p: string, fallbackExt: string) => {
  const seg = (p.split('/').pop() || '').split('?')[0]
  return /\.[a-z0-9]+$/i.test(seg) ? seg : `file.${fallbackExt}`
}
const isAudioUrl = (u: string) => /\.(mp3|m4a|wav|aac|flac|ogg)(\?|$)/i.test(u)

export default function Publish() {
  const [workId, setWorkId] = useState(0) // >0 为编辑模式
  const [isDraft, setIsDraft] = useState(false) // 当前编辑的是草稿
  const [mySpaces, setMySpaces] = useState<Space[]>([])
  const [selectedSpaces, setSelectedSpaces] = useState<number[]>([])

  const [title, setTitle] = useState('')
  const [type, setType] = useState<WorkType>('text')
  const [textContent, setTextContent] = useState('')
  const [preview, setPreview] = useState(false) // 说明区 编辑/预览 切换
  const [editorFullscreen, setEditorFullscreen] = useState(false)
  const [editorFocus, setEditorFocus] = useState(false)
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0 })
  const [images, setImages] = useState<string[]>([])
  const [mediaFile, setMediaFile] = useState('')
  const [mediaKind, setMediaKind] = useState<'video' | 'audio'>('video')
  const [mediaName, setMediaName] = useState('')
  const [coverFile, setCoverFile] = useState('') // 非图片类型封面（本地路径 / COS URL）
  const [techCode, setTechCode] = useState('')
  const [externalLink, setExternalLink] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useLoad(async (params) => {
    const wid = Number(params?.workId || 0)
    const sp = Number(params?.spaceId || 0)
    setWorkId(wid)
    Taro.setNavigationBarTitle({ title: wid ? '编辑作品' : '发布作品' })

    const spaces = (await getMySpaces()).data
    setMySpaces(spaces)

    if (wid) {
      const w = (await getWork(wid)).data
      setIsDraft(w.isDraft)
      setTitle(w.title)
      setType(w.type)
      setTextContent(w.textContent || '')
      setImages(w.mediaUrls || [])
      if (w.type === 'audio_video' && w.mediaUrls?.[0]) {
        const u = w.mediaUrls[0]
        setMediaKind(isAudioUrl(u) ? 'audio' : 'video')
        setMediaFile(u)
        setMediaName(keyOfUrl(u))
      }
      setTechCode(w.techCode || '')
      setExternalLink(w.externalLink || '')
      // 非图片类型封面回填（图片类型封面=首图，无需单独回填）
      if (w.coverUrl && w.type !== 'image') setCoverFile(w.coverUrl)
      setTagsInput((w.tags || []).join('，'))
    } else {
      // 从群空间页进入则预选该群
      setSelectedSpaces(sp ? [sp] : [])
    }
  })

  const addImages = async () => {
    const need = 9 - images.length
    if (need <= 0) return
    const res = await Taro.chooseMedia({ count: need, mediaType: ['image'] })
    setImages([...images, ...res.tempFiles.map((f) => f.tempFilePath)])
  }

  const removeImage = (i: number) => setImages(images.filter((_, x) => x !== i))

  const pickVideo = async () => {
    const res = await Taro.chooseMedia({ count: 1, mediaType: ['video'] })
    const f = res.tempFiles[0]
    setMediaKind('video')
    setMediaFile(f.tempFilePath)
    setMediaName(fileNameOf(f.tempFilePath, 'mp4'))
  }

  /** 音频：chooseMessageFile 支持纯音频文件（chooseMedia 不含音频） */
  const pickAudio = async () => {
    const res = await Taro.chooseMessageFile({
      count: 1, type: 'file',
      extension: ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg'],
    })
    const f = res.tempFiles[0]
    setMediaKind('audio')
    setMediaFile(f.path)
    setMediaName(f.name || fileNameOf(f.path, 'mp3'))
  }

  /** 非图片类型的封面选择（选一张图） */
  const pickCover = async () => {
    const res = await Taro.chooseMedia({ count: 1, mediaType: ['image'] })
    setCoverFile(res.tempFiles[0].tempFilePath)
  }

  /** 本地临时文件直传 COS 返回 key；编辑回填的 COS URL 直接提取 key，不重复上传 */
  const uploadOne = async (file: string, fallbackExt: string): Promise<string> => {
    if (!isLocalFile(file)) return keyOfUrl(file)
    const presign = (await getPresign(fileNameOf(file, fallbackExt))).data
    await uploadToCos(file, presign)
    return presign.key
  }

  const toggleSpace = (id: number) => {
    setSelectedSpaces((list) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  /** MVP 标签：作者手填，≤5，顿号/逗号/空格分隔 */
  const parseTags = (raw: string): string[] => {
    const tags = raw.split(/[，,、\s]+/).map((t) => t.trim()).filter(Boolean)
    return Array.from(new Set(tags)).slice(0, 5)
  }

  const toast = (title: string) => Taro.showToast({ title, icon: 'none' })

  const rememberEditorSelection = (cursor: number) => {
    setEditorSelection({ start: cursor, end: cursor })
  }

  const insertMarkdown = (prefix: string, suffix = '', placeholder = '内容') => {
    const start = Math.min(editorSelection.start, textContent.length)
    const end = Math.min(Math.max(editorSelection.end, start), textContent.length)
    const selected = textContent.slice(start, end)
    const inner = selected || placeholder
    const inserted = `${prefix}${inner}${suffix}`
    setTextContent(textContent.slice(0, start) + inserted + textContent.slice(end))
    const cursor = selected ? start + inserted.length : start + prefix.length + inner.length
    setEditorSelection({ start: cursor, end: cursor })
    setEditorFocus(true)
  }

  const insertLinePrefix = (prefix: string) => {
    const start = Math.min(editorSelection.start, textContent.length)
    const lineStart = textContent.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    setTextContent(textContent.slice(0, lineStart) + prefix + textContent.slice(lineStart))
    const cursor = start + prefix.length
    setEditorSelection({ start: cursor, end: cursor })
    setEditorFocus(true)
  }

  /** isPublish=true 发布；false 保存草稿（新建或编辑草稿均可用） */
  const submit = async (isPublish: boolean) => {
    if (submitting) return
    if (!title.trim()) return toast('请填写标题')
    if (type === 'text' && !textContent.trim()) return toast('请填写正文')
    if (type === 'image' && !images.length) return toast('请至少选择 1 张图片')
    if (type === 'audio_video' && !mediaFile) return toast('请选择视频或音频文件')
    if (type === 'tech' && !techCode.trim()) return toast('请填写技术内容')
    if (type === 'external' && !externalLink.trim()) return toast('请填写外部链接')
    setSubmitting(true)
    try {
      // 先直传 COS 再提交：mediaKeys/coverKey 落库为 COS object key（ADR-0005）
      let mediaKeys: string[] | undefined
      let coverKey: string | null | undefined
      if (type === 'image') {
        mediaKeys = await Promise.all(images.map((f) => uploadOne(f, 'jpg')))
        coverKey = mediaKeys[0] ?? null // 图片类型封面=首图
      } else if (type === 'audio_video') {
        mediaKeys = [await uploadOne(mediaFile, mediaKind === 'audio' ? 'mp3' : 'mp4')]
        coverKey = coverFile ? await uploadOne(coverFile, 'jpg') : undefined
      } else if (coverFile) {
        coverKey = await uploadOne(coverFile, 'jpg')
      }

      const input: UpsertWorkInput = {
        title: title.trim(),
        type,
        textContent: textContent.trim() ? textContent.trim() : null,
        mediaKeys,
        coverKey,
        tags: parseTags(tagsInput),
        externalLink: type === 'external' ? externalLink.trim() : null,
        techCode: type === 'tech' ? techCode.trim() : null,
        // draft 语义：true=存草稿；false=草稿转发布；undefined=普通发布/编辑
        draft: isPublish ? (isDraft ? false : undefined) : true,
      }
      if (isPublish && (!workId || isDraft)) input.spaceIds = selectedSpaces

      if (workId) await editWork(workId, input)
      else await publishWork(input)
      Taro.showToast({ title: isPublish ? '已发布' : '已保存草稿', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (err) {
      reportClientError('save', err, { workId, type, isPublish })
      toast((err as Error)?.message || (isPublish ? '发布失败，请重试' : '保存失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='publish'>
      <View className='field'>
        <Text className='field-label'>标题</Text>
        <Input className='field-input' value={title} onInput={(e) => setTitle(e.detail.value)} placeholder='给这颗星光起个名字' maxlength={40} />
      </View>

      <View className='field'>
        <Text className='field-label'>类型</Text>
        <View className='type-row'>
          {TYPES.map((t) => (
            <View key={t} className={`type-chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
              <Text>{WORK_TYPE_EMOJI[t]}</Text>
              <Text>{WORK_TYPE_LABEL[t]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='field'>
        <Text className='field-label'>内容</Text>
        {type === 'image' && (
          <View className='img-picker'>
            <View className='img-grid'>
              {images.map((url, i) => (
                <View key={i} className='img-item'>
                  <Image src={url} mode='aspectFill' />
                  <Text className='img-remove' onClick={() => removeImage(i)}>×</Text>
                </View>
              ))}
              {images.length < 9 ? (
                <View className='img-add' onClick={addImages}><Text>＋</Text><Text className='img-add-text'>选图</Text></View>
              ) : null}
            </View>
            <Text className='field-hint'>{images.length}/9 张（首图为封面）</Text>
          </View>
        )}
        {type === 'audio_video' && (
          <View className='media-pick'>
            <View className='media-row'>
              <View className={`media-btn ${mediaKind === 'video' ? 'on' : ''}`} onClick={pickVideo}>🎬 选视频</View>
              <View className={`media-btn ${mediaKind === 'audio' ? 'on' : ''}`} onClick={pickAudio}>🎵 选音频</View>
            </View>
            {mediaFile ? <Text className='media-picked'>✅ 已选{mediaKind === 'video' ? '视频' : '音频'}：{mediaName}</Text> : null}
          </View>
        )}
        {type === 'tech' && (
          <Textarea className='field-textarea code' value={techCode} onInput={(e) => setTechCode(e.detail.value)} placeholder='粘贴代码片段…' autoHeight maxlength={5000} />
        )}
        {type === 'external' && (
          <Input className='field-input' value={externalLink} onInput={(e) => setExternalLink(e.detail.value)} placeholder='https://…' />
        )}
      </View>

      {/* 封面：图片类型默认首图，其余类型可选 */}
      {type !== 'image' && (
        <View className='field'>
          <Text className='field-label'>封面（可选）</Text>
          {coverFile ? (
            <View className='cover-pick'>
              <Image className='cover-img' src={coverFile} mode='aspectFill' />
              <View className='cover-actions'>
                <Text className='cover-btn' onClick={pickCover}>更换</Text>
                <Text className='cover-btn danger' onClick={() => setCoverFile('')}>移除</Text>
              </View>
            </View>
          ) : (
            <View className='cover-add' onClick={pickCover}>
              <Text>＋</Text>
              <Text className='cover-add-text'>上传封面</Text>
            </View>
          )}
        </View>
      )}

      {/* 内容说明：所有类型都支持（文字类型即正文，其余记录介绍/心得），Markdown */}
      <View className='field'>
        <View className='field-label-row'>
          <Text className='field-label'>{type === 'text' ? '正文' : '内容说明'}</Text>
          <View className='preview-tabs'>
            <Text className={`preview-tab ${!preview ? 'on' : ''}`} onClick={() => setPreview(false)}>编辑</Text>
            <Text className={`preview-tab ${preview ? 'on' : ''}`} onClick={() => setPreview(true)}>预览</Text>
          </View>
        </View>
        {preview ? (
          textContent.trim()
            ? <View className='preview-box'><Markdown content={textContent} /></View>
            : <View className='preview-empty'>还没有内容，切回「编辑」写点什么</View>
        ) : (
          <View className={`editor-shell ${editorFullscreen ? 'fullscreen' : ''}`}>
            <View className='editor-toolbar'>
              <Text className='editor-tool' onClick={() => insertMarkdown('**', '**', '加粗')}>B</Text>
              <Text className='editor-tool italic' onClick={() => insertMarkdown('*', '*', '斜体')}>I</Text>
              <Text className='editor-tool code-tool' onClick={() => insertMarkdown('`', '`', '代码')}>`</Text>
              <Text className='editor-tool' onClick={() => insertLinePrefix('## ')}>H2</Text>
              <Text className='editor-tool' onClick={() => insertLinePrefix('- ')}>列表</Text>
              <Text className='editor-tool' onClick={() => insertLinePrefix('> ')}>引用</Text>
              <Text className='editor-tool' onClick={() => insertMarkdown('[', '](https://)', '链接')}>链接</Text>
              <Text className='editor-tool' onClick={() => insertMarkdown('\n', '', '')}>换行</Text>
              <Text className='editor-expand' onClick={() => setEditorFullscreen(!editorFullscreen)}>{editorFullscreen ? '退出全屏' : '放大编辑'}</Text>
            </View>
            <Textarea
              className='field-textarea editor-textarea'
              value={textContent}
              cursor={editorSelection.start}
              focus={editorFocus}
              onFocus={() => setEditorFocus(true)}
              onBlur={() => setEditorFocus(false)}
              onInput={(e) => {
                setTextContent(e.detail.value)
                rememberEditorSelection(e.detail.cursor)
              }}
              placeholder={type === 'text' ? '写点什么，支持 Markdown…' : '记录介绍、心得…支持 Markdown'}
              autoHeight={!editorFullscreen}
              maxlength={20000}
            />
          </View>
        )}
        <Text className='field-hint'>{MD_HINT}</Text>
      </View>

      <View className='field'>
        <Text className='field-label'>标签（≤5 个）</Text>
        <Input className='field-input' value={tagsInput} onInput={(e) => setTagsInput(e.detail.value)} placeholder='用顿号分隔，如：原创，读书笔记' maxlength={60} />
      </View>

      {/* 群空间：可选；不选群时作品本体仍会发布，可从「我的作品」继续管理 */}
      {(isDraft || !workId) ? (
        <View className='field'>
          <Text className='field-label'>发布到群空间（可选）</Text>
          <View className='space-row'>
            {mySpaces.map((s) => (
              <View key={s.id} className={`space-chip ${selectedSpaces.includes(s.id) ? 'on' : ''}`} onClick={() => toggleSpace(s.id)}>
                {s.name}
              </View>
            ))}
          </View>
          {!mySpaces.length ? <Text className='field-hint'>还没有群空间，先去首页创建一个吧</Text> : null}
        </View>
      ) : null}

      <View className='btn-row'>
        {(!workId || isDraft) ? (
          <View className={`btn ghost submit-btn ${submitting ? 'disabled' : ''}`} onClick={() => submit(false)}>存草稿</View>
        ) : null}
        <View className={`btn primary submit-btn ${submitting ? 'disabled' : ''}`} onClick={() => submit(true)}>
          {workId && !isDraft ? '保存修改' : '发布'}
        </View>
      </View>
    </View>
  )
}
