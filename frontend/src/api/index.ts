/**
 * API 层（业务入口）
 * 当前实现指向 mock 服务（前端先行）；真实后端就绪后，将各函数替换为
 * `http.ts` 的调用，页面代码无需改动。
 *
 * 用法：`import { getFeed } from '@/api'`
 */
export * from '../mock'
