import type { WorkType } from '../types'

/** 作品类型 → 展示标签 */
export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  text: '文字',
  image: '图片',
  audio_video: '音视频',
  tech: '技术',
  external: '外部'
}

export const WORK_TYPE_EMOJI: Record<WorkType, string> = {
  text: '📝',
  image: '🖼️',
  audio_video: '🎬',
  tech: '💻',
  external: '🔗'
}
