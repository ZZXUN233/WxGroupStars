import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Projection } from '../types'
import { timeAgo, displayName, initial } from '../utils/format'
import { WORK_TYPE_EMOJI, WORK_TYPE_LABEL } from '../utils/workType'
import './WorkCard.scss'

interface Props {
  projection: Projection
  spaceName?: string
}

export default function WorkCard({ projection, spaceName }: Props) {
  const { work } = projection
  const goDetail = () => {
    Taro.navigateTo({ url: `/pages/work-detail/index?projectionId=${projection.id}&spaceId=${projection.spaceId}` })
  }

  return (
    <View className='work-card card' onClick={goDetail}>
      {work.coverUrl ? (
        <Image className='work-cover' src={work.coverUrl} mode='aspectFill' />
      ) : (
        <View className='work-cover work-cover-fallback'>
          <Text className='work-cover-emoji'>{WORK_TYPE_EMOJI[work.type]}</Text>
        </View>
      )}
      <View className='work-body'>
        <View className='work-title'>{work.title}</View>
        <View className='work-meta'>
          <View className='work-author'>
            <View className='avatar avatar-sm'>
              {work.author.avatarUrl ? <Image src={work.author.avatarUrl} mode='aspectFill' /> : <Text>{initial(work.author.nickname)}</Text>}
            </View>
            <Text className='work-author-name'>{displayName(work.author.nickname)}</Text>
          </View>
          <Text className='work-type'>{WORK_TYPE_LABEL[work.type]}</Text>
        </View>
        <View className='work-stats'>
          <View className='work-stat-metrics'>
            <Text>❤️ {projection.likeCount}</Text>
            <Text>💬 {projection.commentCount}</Text>
            <Text>🔖 {projection.collectCount}</Text>
          </View>
          <Text className='time'>{spaceName ? `${spaceName} · ` : ''}{timeAgo(projection.projectedAt)}</Text>
        </View>
      </View>
    </View>
  )
}
