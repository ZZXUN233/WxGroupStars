import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'
import './Markdown.scss'

/**
 * 轻量 Markdown 渲染（无外部依赖，ADR 记录）。
 * 支持：标题 / 加粗 / 斜体 / 行内代码 / 代码块 / 无序·有序列表 / 引用 / 链接 / 图片。
 * 说明 / 正文统一走此组件渲染，发布页预览与详情页共用。
 *
 * 实现：逐行解析出块级节点，块内容递归走行内解析（parseInline）。
 */

// 行内 token：加粗 / 斜体 / 行内代码 / 图片 / 链接（交替分组捕获）
const INLINE_RE = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\))/g

const ORDERED_RE = /^\d+\.\s+/
const BULLET_RE = /^[-*]\s+/
const HEADING_RE = /^(#{1,6})\s+(.*)$/

/** 行内解析：返回可渲染节点数组（普通文本为 string） */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  INLINE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const k = `${keyPrefix}-i${key++}`
    // 分组索引：0=整体 1/2=加粗 3/4=斜体 5/6=行内码 7/8=图片alt/url 9/10=链接text/url
    const [wholeBold, bold, wholeItalic, italic, wholeCode, code, , imgUrl, linkText, linkUrl] = m.slice(1)
    if (wholeBold !== undefined) {
      nodes.push(<Text key={k} className='md-strong'>{parseInline(bold, k)}</Text>)
    } else if (wholeItalic !== undefined) {
      nodes.push(<Text key={k} className='md-em'>{parseInline(italic, k)}</Text>)
    } else if (wholeCode !== undefined) {
      nodes.push(<Text key={k} className='md-code'>{code}</Text>)
    } else if (imgUrl !== undefined) {
      nodes.push(<Image key={k} className='md-img' src={imgUrl} mode='widthFix' />)
    } else if (linkUrl !== undefined) {
      nodes.push(
        <Text
          key={k}
          className='md-link'
          onClick={() => {
            Taro.setClipboardData({ data: linkUrl })
            Taro.showToast({ title: '链接已复制到剪贴板', icon: 'none' })
          }}
        >
          {parseInline(linkText, k)}
        </Text>
      )
    }
    last = INLINE_RE.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** 块级解析：按行切分出标题/代码块/引用/列表/段落 */
function parseBlocks(lines: string[], keyPrefix = 'md'): ReactNode[] {
  const nodes: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    const k = `${keyPrefix}-b${key++}`

    if (!trimmed) {
      i++
      continue
    }

    // 代码块：``` 起止（保留原内容，不解析行内）
    if (trimmed.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳过闭合 ```
      nodes.push(
        <View key={k} className='md-pre'>
          <Text>{buf.join('\n')}</Text>
        </View>
      )
      continue
    }

    // 标题
    const heading = HEADING_RE.exec(trimmed)
    if (heading) {
      const level = heading[1].length
      nodes.push(
        <View key={k} className={`md-h md-h${level}`}>{parseInline(heading[2], k)}</View>
      )
      i++
      continue
    }

    // 引用：连续 "> " 行合并，内部递归块级解析
    if (trimmed.startsWith('>')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      nodes.push(<View key={k} className='md-quote'>{parseBlocks(buf, k)}</View>)
      continue
    }

    // 无序列表：连续 "-/× " 行；空行后仍是列表项则继续
    if (BULLET_RE.test(trimmed)) {
      const items: ReactNode[] = []
      let itemKey = 0
      while (i < lines.length) {
        const t = lines[i].trim()
        if (BULLET_RE.test(t)) {
          items.push(
            <View key={`${k}-${itemKey}`} className='md-li'>
              <Text className='md-bullet'>•</Text>
              <View className='md-li-body'>{parseInline(t.replace(BULLET_RE, ''), `${k}-${itemKey}`)}</View>
            </View>
          )
          i++
          itemKey++
        } else if (!t && i + 1 < lines.length && BULLET_RE.test(lines[i + 1].trim())) {
          i++
        } else {
          break
        }
      }
      nodes.push(<View key={k} className='md-ul'>{items}</View>)
      continue
    }

    // 有序列表：同上，前缀数字渲染
    if (ORDERED_RE.test(trimmed)) {
      const items: ReactNode[] = []
      let itemKey = 0
      while (i < lines.length) {
        const t = lines[i].trim()
        if (ORDERED_RE.test(t)) {
          items.push(
            <View key={`${k}-${itemKey}`} className='md-li'>
              <Text className='md-bullet'>{itemKey + 1}.</Text>
              <View className='md-li-body'>{parseInline(t.replace(ORDERED_RE, ''), `${k}-${itemKey}`)}</View>
            </View>
          )
          i++
          itemKey++
        } else if (!t && i + 1 < lines.length && ORDERED_RE.test(lines[i + 1].trim())) {
          i++
        } else {
          break
        }
      }
      nodes.push(<View key={k} className='md-ol'>{items}</View>)
      continue
    }

    // 段落：收集连续非空、非块标记行
    const buf: string[] = []
    while (i < lines.length) {
      const t = lines[i]
      const tt = t.trim()
      if (!tt || tt.startsWith('```') || HEADING_RE.test(tt) || tt.startsWith('>') || BULLET_RE.test(tt) || ORDERED_RE.test(tt)) {
        break
      }
      buf.push(t)
      i++
    }
    nodes.push(<View key={k} className='md-p'>{parseInline(buf.join('\n'), k)}</View>)
  }
  return nodes
}

export default function Markdown({ content }: { content: string }) {
  return <View className='md'>{parseBlocks(content.split('\n'))}</View>
}
