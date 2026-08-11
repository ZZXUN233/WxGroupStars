import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { Work } from '../../types'
import { getMyDrafts } from '../../api'
import { dateTime } from '../../utils/format'
import { WORK_TYPE_LABEL } from '../../utils/workType'
import './index.scss'

/** 我的草稿：仅作者可见的未发布作品，可继续编辑 / 发布（后端 Work.isDraft） */
export default function Drafts() {
  const [drafts, setDrafts] = useState<Work[] | null>(null)

  const load = async () => {
    const res = await getMyDrafts()
    setDrafts(res.data)
  }

  useDidShow(() => { load() })

  const continueEdit = (w: Work) => {
    Taro.navigateTo({ url: `/pages/publish/index?workId=${w.id}` })
  }

  if (!drafts) return <View className='empty'>加载中…</View>

  return (
    <ScrollView scrollY className='drafts'>
      {drafts.length ? (
        drafts.map((w) => (
          <View key={w.id} className='draft-item' onClick={() => continueEdit(w)}>
            <View className='draft-main'>
              <Text className='draft-title'>{w.title || '未命名草稿'}</Text>
              <View className='draft-meta'>
                <Text className='draft-chip'>{WORK_TYPE_LABEL[w.type]}</Text>
                <Text className='draft-time'>更新于 {dateTime(w.updatedAt)}</Text>
              </View>
            </View>
            <Text className='draft-edit'>继续编辑 ›</Text>
          </View>
        ))
      ) : (
        <View className='empty'>还没有草稿，去发布页写一篇吧</View>
      )}
    </ScrollView>
  )
}
