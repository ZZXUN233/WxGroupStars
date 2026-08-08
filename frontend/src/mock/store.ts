/**
 * Mock 数据存储（内存实现，模拟后端）
 * 页面通过 api 层调用，可整体切换到真实后端。
 */
import type {
  Comment, Member, Projection, Space, User, Work
} from '../types'

/** 生成占位封面（data URI SVG，自包含，无需外网域名） */
export function ph(seed: string, a = '#4f46e5', b = '#7c3aed'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
  </linearGradient></defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <text x="200" y="160" font-size="42" text-anchor="middle" fill="rgba(255,255,255,.85)">${seed}</text>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/** 当前登录用户（mock 固定身份） */
export const ME: User = { id: 1001, nickname: '我', avatarUrl: ph('我', '#10b981', '#0e9f6e') }

export const USERS: Record<number, User> = {
  1001: ME,
  1002: { id: 1002, nickname: '张三', avatarUrl: ph('张', '#6366f1', '#4f46e5') },
  1003: { id: 1003, nickname: '李四', avatarUrl: ph('李', '#0ea5e9', '#0284c7') },
  1004: { id: 1004, nickname: '王五', avatarUrl: ph('王', '#f59e0b', '#d97706') }
}

export const SPACES: Space[] = [
  {
    id: 2001, name: 'AI 创造交流群', coverUrl: null, creatorId: 1001,
    memberCount: 4, workCount: 5, myRole: 'owner', createdAt: '2026-01-10T10:00:00.000Z'
  },
  {
    id: 2002, name: '摄影交流群', coverUrl: null, creatorId: 1002,
    memberCount: 3, workCount: 3, myRole: 'member', createdAt: '2026-03-02T10:00:00.000Z'
  }
]

export const MEMBERS: Member[] = [
  { id: 1, user: USERS[1001], role: 'owner', joinedAt: '2026-01-10T10:00:00.000Z' },
  { id: 2, user: USERS[1002], role: 'member', joinedAt: '2026-01-10T10:01:00.000Z' },
  { id: 3, user: USERS[1003], role: 'member', joinedAt: '2026-01-12T10:00:00.000Z' },
  { id: 4, user: USERS[1004], role: 'admin', joinedAt: '2026-02-01T10:00:00.000Z' },
  { id: 5, user: USERS[1001], role: 'member', joinedAt: '2026-03-02T10:00:00.000Z' },
  { id: 6, user: USERS[1002], role: 'owner', joinedAt: '2026-03-02T10:00:00.000Z' },
  { id: 7, user: USERS[1003], role: 'member', joinedAt: '2026-03-05T10:00:00.000Z' }
]

// spaceId -> member ids
export const SPACE_MEMBERS: Record<number, number[]> = {
  2001: [1, 2, 3, 4],
  2002: [5, 6, 7]
}

export const WORKS: Work[] = [
  {
    id: 3001, title: '《AI 时代的人类》', author: USERS[1002], type: 'text',
    textContent: '当机器开始思考，人类的价值将回归于创造、情感与判断。',
    mediaUrls: [], coverUrl: ph('AI', '#6366f1', '#4f46e5'), tags: ['观点', 'AI'],
    externalLink: null, techCode: null, reviewStatus: 'pass',
    createdAt: '2026-07-28T03:00:00.000Z', updatedAt: '2026-07-28T03:00:00.000Z'
  },
  {
    id: 3002, title: '《夏夜》', author: USERS[1002], type: 'image',
    textContent: null, mediaUrls: [ph('夏夜1', '#f6efe0', '#e8dcc3'), ph('夏夜2', '#dbeafe', '#7aa2e3')],
    coverUrl: ph('夏夜', '#f6efe0', '#e8dcc3'), tags: ['摄影', '夜晚'],
    externalLink: null, techCode: null, reviewStatus: 'pass',
    createdAt: '2026-08-04T12:00:00.000Z', updatedAt: '2026-08-04T12:00:00.000Z'
  },
  {
    id: 3003, title: '《云南摄影》', author: USERS[1003], type: 'image',
    textContent: null, mediaUrls: [ph('滇', '#dbeafe', '#7aa2e3')],
    coverUrl: ph('云南', '#dbeafe', '#7aa2e3'), tags: ['摄影', '旅行'],
    externalLink: null, techCode: null, reviewStatus: 'pass',
    createdAt: '2026-08-02T09:00:00.000Z', updatedAt: '2026-08-02T09:00:00.000Z'
  },
  {
    id: 3004, title: '《群星 CLI》', author: USERS[1004], type: 'tech',
    textContent: null, mediaUrls: [], coverUrl: ph('CLI', '#e9e5fb', '#8b83e8'), tags: ['开源', '工具'],
    externalLink: 'https://github.com/example/group-stars-cli', techCode: '```bash\n$ gs init\n$ gs publish --space ai\n```',
    reviewStatus: 'pass', createdAt: '2026-07-28T09:00:00.000Z', updatedAt: '2026-07-28T09:00:00.000Z'
  },
  {
    id: 3005, title: '《机器人实验》', author: USERS[1003], type: 'tech',
    textContent: null, mediaUrls: [], coverUrl: ph('机器', '#0ea5e9', '#0284c7'), tags: ['机器人', '实验'],
    externalLink: null, techCode: '```python\ndef robot():\n    return "hello"\n```',
    reviewStatus: 'pass', createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 3006, title: '《夏夜的声音》', author: USERS[1001], type: 'audio_video',
    textContent: null, mediaUrls: ['cos://audio/summer-night.mp3'],
    coverUrl: ph('声', '#2b2a7a', '#6d5ae8'), tags: ['音乐', '原创'],
    externalLink: null, techCode: null, reviewStatus: 'pass',
    createdAt: '2026-08-05T14:00:00.000Z', updatedAt: '2026-08-05T14:00:00.000Z'
  },
  {
    id: 3007, title: '《Web 发展的十年》', author: USERS[1004], type: 'external',
    textContent: null, mediaUrls: [], coverUrl: ph('Web', '#f59e0b', '#d97706'), tags: ['文章', '外链'],
    externalLink: 'https://example.com/web-decade', techCode: null,
    reviewStatus: 'pass', createdAt: '2026-08-06T02:00:00.000Z', updatedAt: '2026-08-06T02:00:00.000Z'
  }
]

export interface MockProjection extends Projection {
  // 记录作者是否仍为成员不影响投影（ADR-0008）
  _spaceId: number
  _workId: number
}

export const PROJECTIONS: MockProjection[] = [
  { id: 5001, spaceId: 2001, work: WORKS[0], likeCount: 54, commentCount: 2, collectCount: 6, projectedAt: '2026-07-28T09:00:00.000Z', likedByMe: false, _spaceId: 2001, _workId: 3001 },
  { id: 5002, spaceId: 2001, work: WORKS[1], likeCount: 128, commentCount: 3, collectCount: 12, projectedAt: '2026-08-04T12:00:00.000Z', likedByMe: true, _spaceId: 2001, _workId: 3002 },
  { id: 5003, spaceId: 2001, work: WORKS[3], likeCount: 54, commentCount: 1, collectCount: 4, projectedAt: '2026-07-28T09:00:00.000Z', likedByMe: false, _spaceId: 2001, _workId: 3004 },
  { id: 5004, spaceId: 2001, work: WORKS[4], likeCount: 32, commentCount: 1, collectCount: 2, projectedAt: '2026-08-01T08:00:00.000Z', likedByMe: false, _spaceId: 2001, _workId: 3005 },
  { id: 5005, spaceId: 2001, work: WORKS[5], likeCount: 21, commentCount: 0, collectCount: 1, projectedAt: '2026-08-05T14:00:00.000Z', likedByMe: false, _spaceId: 2001, _workId: 3006 },
  { id: 5006, spaceId: 2002, work: WORKS[1], likeCount: 76, commentCount: 1, collectCount: 8, projectedAt: '2026-08-02T09:00:00.000Z', likedByMe: true, _spaceId: 2002, _workId: 3003 },
  { id: 5007, spaceId: 2002, work: WORKS[5], likeCount: 15, commentCount: 0, collectCount: 0, projectedAt: '2026-08-05T14:00:00.000Z', likedByMe: false, _spaceId: 2002, _workId: 3006 },
  { id: 5008, spaceId: 2002, work: WORKS[6], likeCount: 9, commentCount: 1, collectCount: 0, projectedAt: '2026-08-06T02:00:00.000Z', likedByMe: false, _spaceId: 2002, _workId: 3007 }
]

export const COMMENTS: Comment[] = [
  {
    id: 7001, user: USERS[1003], content: '这个观点很有启发。', replyToUser: null,
    replies: [
      { id: 7002, user: USERS[1002], content: '谢谢！欢迎交流。', replyToUser: USERS[1003], replies: [], createdAt: '2026-08-04T13:00:00.000Z', isMine: false }
    ],
    createdAt: '2026-08-04T12:30:00.000Z', isMine: false
  },
  {
    id: 7003, user: USERS[1004], content: '光线构图都很棒。', replyToUser: null,
    replies: [], createdAt: '2026-08-04T14:00:00.000Z', isMine: false
  }
]

/** 评论挂到投影：projectionId -> commentIds */
export const PROJECTION_COMMENTS: Record<number, number[]> = {
  5002: [7001, 7003]
}

/** 当前会话（mock：已登录） */
export const CURRENT_SESSION = { token: 'mock-token', user: ME }
