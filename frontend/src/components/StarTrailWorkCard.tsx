import { Image, Text, View } from '@tarojs/components'
import type { Work } from '../types'
import { displayName, initial } from '../utils/format'
import { WORK_TYPE_EMOJI, WORK_TYPE_LABEL } from '../utils/workType'
import './WorkCard.scss'

export default function StarTrailWorkCard({ work }: { work: Work }) {
  return (
    <View className='work-card card'>
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
      </View>
    </View>
  )
}
