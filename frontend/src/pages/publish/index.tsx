import { Image, Input, Text, Textarea, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import type { Space, UpsertWorkInput, WorkType } from '../../types'
import { editWork, getMySpaces, getWork, publishWork } from '../../api'
import { WORK_TYPE_EMOJI, WORK_TYPE_LABEL } from '../../utils/workType'
import './index.scss'

const TYPES: WorkType[] = ['text', 'image', 'audio_video', 'tech', 'external']

export default function Publish() {
  const [workId, setWorkId] = useState(0) // >0 为编辑模式
  const [mySpaces, setMySpaces] = useState<Space[]>([])
  const [selectedSpaces, setSelectedSpaces] = useState<number[]>([])

  const [title, setTitle] = useState('')
  const [type, setType] = useState<WorkType>('text')
  const [textContent, setTextContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [mediaFile, setMediaFile] = useState('')
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
      setTitle(w.title)
      setType(w.type)
      setTextContent(w.textContent || '')
      setImages(w.mediaUrls || [])
      setMediaFile(w.mediaUrls?.[0] || '')
      setTechCode(w.techCode || '')
      setExternalLink(w.externalLink || '')
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

  const pickMedia = async () => {
    const res = await Taro.chooseMedia({ count: 1, mediaType: ['video', 'image'] })
    setMediaFile(res.tempFiles[0].tempFilePath)
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

  const submit = async () => {
    if (submitting) return
    if (!title.trim()) return toast('请填写标题')
    if (type === 'text' && !textContent.trim()) return toast('请填写正文')
    if (type === 'image' && !images.length) return toast('请至少选择 1 张图片')
    if (type === 'audio_video' && !mediaFile) return toast('请选择媒体文件')
    if (type === 'tech' && !techCode.trim()) return toast('请填写技术内容')
    if (type === 'external' && !externalLink.trim()) return toast('请填写外部链接')
    if (!workId && !selectedSpaces.length) return toast('请选择要发布的群空间')

    const input: UpsertWorkInput = {
      title: title.trim(),
      type,
      textContent: type === 'text' ? textContent.trim() : null,
      mediaKeys: type === 'image' ? images : type === 'audio_video' ? [mediaFile] : undefined,
      coverKey: type === 'image' ? images[0] : undefined,
      tags: parseTags(tagsInput),
      externalLink: type === 'external' ? externalLink.trim() : null,
      techCode: type === 'tech' ? techCode.trim() : null,
      spaceIds: workId ? undefined : selectedSpaces
    }

    setSubmitting(true)
    try {
      if (workId) await editWork(workId, input)
      else await publishWork(input)
      Taro.showToast({ title: workId ? '已保存' : '已发布', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
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
        {type === 'text' && (
          <Textarea className='field-textarea' value={textContent} onInput={(e) => setTextContent(e.detail.value)} placeholder='写点什么…' autoHeight maxlength={2000} />
        )}
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
          <View className='media-pick' onClick={pickMedia}>
            {mediaFile ? <Text>✅ 已选媒体文件（点击可更换）</Text> : <Text>＋ 选择视频 / 图片</Text>}
          </View>
        )}
        {type === 'tech' && (
          <Textarea className='field-textarea code' value={techCode} onInput={(e) => setTechCode(e.detail.value)} placeholder='粘贴代码片段…' autoHeight maxlength={5000} />
        )}
        {type === 'external' && (
          <Input className='field-input' value={externalLink} onInput={(e) => setExternalLink(e.detail.value)} placeholder='https://…' />
        )}
      </View>

      <View className='field'>
        <Text className='field-label'>标签（≤5 个）</Text>
        <Input className='field-input' value={tagsInput} onInput={(e) => setTagsInput(e.detail.value)} placeholder='用顿号分隔，如：原创，读书笔记' maxlength={60} />
      </View>

      {!workId ? (
        <View className='field'>
          <Text className='field-label'>发布到群空间</Text>
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

      <View className={`btn primary submit ${submitting ? 'disabled' : ''}`} onClick={submit}>
        {workId ? '保存修改' : '发布'}
      </View>
    </View>
  )
}
