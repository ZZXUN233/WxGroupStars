import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import type { Work } from '../../types'
import { getMyWorks } from '../../api'
import { dateTime } from '../../utils/format'
import { WORK_TYPE_LABEL } from '../../utils/workType'
import './index.scss'

/** 我的作品：仅作者可见，包含已发布、未投影作品和草稿，可继续编辑 */
export default function Drafts() {
  const [works, setWorks] = useState<Work[] | null>(null)

  const load = async () => {
    const res = await getMyWorks()
    setWorks(res.data)
  }

  useDidShow(() => { load() })

  const continueEdit = (w: Work) => {
    Taro.navigateTo({ url: `/pages/publish/index?workId=${w.id}` })
  }

  if (!works) return <View className='empty'>加载中…</View>

  return (
    <ScrollView scrollY className='drafts'>
      {works.length ? (
        works.map((w) => (
          <View key={w.id} className='draft-item' onClick={() => continueEdit(w)}>
            <View className='draft-main'>
              <Text className='draft-title'>{w.title || '未命名草稿'}</Text>
              <View className='draft-meta'>
                <Text className='draft-chip'>{w.isDraft ? '草稿' : '已发布'} · {WORK_TYPE_LABEL[w.type]}</Text>
                <Text className='draft-time'>更新于 {dateTime(w.updatedAt)}</Text>
              </View>
            </View>
            <Text className='draft-edit'>编辑作品 ›</Text>
          </View>
        ))
      ) : (
        <View className='empty'>还没有作品，去发布页写一篇吧</View>
      )}
    </ScrollView>
  )
}
