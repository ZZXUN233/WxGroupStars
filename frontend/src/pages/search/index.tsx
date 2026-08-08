import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import WorkCard from '../../components/WorkCard'
import type { Projection, Space } from '../../types'
import { getMySpaces, searchInSpace } from '../../api'
import './index.scss'

export default function Search() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [spaceId, setSpaceId] = useState(0)
  const [spaceName, setSpaceName] = useState('')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Projection[]>([])
  const [searched, setSearched] = useState(false)

  useLoad(async (params) => {
    const spaces = (await getMySpaces()).data
    setSpaces(spaces)
    // 群内搜索：默认首个群，也可由群空间页带 spaceId 进入（ADR-0010）
    const sid = Number(params?.spaceId || spaces[0]?.id || 0)
    setSpaceId(sid)
    setSpaceName(spaces.find((s) => s.id === sid)?.name || '')
  })

  const pickSpace = async () => {
    if (!spaces.length) return
    const res = await Taro.showActionSheet({ itemList: spaces.map((s) => s.name) })
    if (res.tapIndex >= 0) {
      setSpaceId(spaces[res.tapIndex].id)
      setSpaceName(spaces[res.tapIndex].name)
    }
  }

  const doSearch = async () => {
    if (!spaceId) return Taro.showToast({ title: '请先选择群空间', icon: 'none' })
    const res = await searchInSpace(spaceId, q)
    setResults(res.data)
    setSearched(true)
  }

  return (
    <View className='search'>
      <View className='search-bar'>
        <View className='space-select' onClick={pickSpace}>
          <Text>{spaceName || '选择群'}</Text>
          <Text className='caret'>▾</Text>
        </View>
        <Input
          className='search-input'
          value={q}
          onInput={(e) => setQ(e.detail.value)}
          confirmType='search'
          onConfirm={doSearch}
          placeholder='标题 / 作者 / 标签'
        />
        <Text className='search-go' onClick={doSearch}>搜索</Text>
      </View>
      <Text className='search-hint'>仅搜索当前群空间内的投影作品（ADR-0010 群内搜索）</Text>
      <ScrollView scrollY className='search-results'>
        {searched && !results.length ? <View className='empty'>没有找到相关作品</View> : null}
        {results.map((p) => <WorkCard key={p.id} projection={p} spaceName={spaceName} />)}
      </ScrollView>
    </View>
  )
}
