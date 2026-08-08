import { Image, Text, View } from '@tarojs/components'
import type { Comment } from '../types'
import { timeAgo } from '../utils/format'
import './CommentList.scss'

interface Props {
  comments: Comment[]
  onReply: (comment: Comment) => void
  onDelete: (comment: Comment) => void
}

function CommentRow({ c, onReply, onDelete, isReply }: {
  c: Comment
  onReply: (c: Comment) => void
  onDelete: (c: Comment) => void
  isReply?: boolean
}) {
  return (
    <View className={`comment-row ${isReply ? 'is-reply' : ''}`}>
      <View className='comment-avatar avatar avatar-sm'>
        {c.user.avatarUrl ? <Image src={c.user.avatarUrl} mode='aspectFill' /> : null}
        <Text>{c.user.nickname.slice(0, 1)}</Text>
      </View>
      <View className='comment-main'>
        <View className='comment-head'>
          <Text className='comment-name'>{c.user.nickname}</Text>
          <Text className='comment-time'>{timeAgo(c.createdAt)}</Text>
        </View>
        <View className='comment-content'>
          {c.replyToUser ? <Text className='comment-mention'>@{c.replyToUser.nickname} </Text> : null}
          {c.content}
        </View>
        <View className='comment-actions'>
          <Text className='comment-action' onClick={() => onReply(c)}>回复</Text>
          {c.isMine ? <Text className='comment-action danger' onClick={() => onDelete(c)}>删除</Text> : null}
        </View>
        {c.replies.map((r) => (
          <CommentRow key={r.id} c={r} onReply={onReply} onDelete={onDelete} isReply />
        ))}
      </View>
    </View>
  )
}

export default function CommentList({ comments, onReply, onDelete }: Props) {
  if (!comments.length) {
    return <View className='empty'>还没有评论，来抢沙发</View>
  }
  return (
    <View className='comment-list'>
      {comments.map((c) => (
        <CommentRow key={c.id} c={c} onReply={onReply} onDelete={onDelete} />
      ))}
    </View>
  )
}
