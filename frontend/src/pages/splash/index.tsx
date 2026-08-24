import { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

/* ---------- 星星数据（静态） ---------- */
const STARS = [
  // 大星
  { top: '12%', left: '18%', size: 8, delay: 0 },
  { top: '8%', left: '72%', size: 7, delay: 0.3 },
  { top: '22%', left: '45%', size: 9, delay: 0.6 },
  { top: '55%', left: '65%', size: 6, delay: 0.9 },
  { top: '70%', left: '25%', size: 7, delay: 0.2 },
  // 中星
  { top: '35%', left: '10%', size: 5, delay: 1.1 },
  { top: '60%', left: '82%', size: 5.5, delay: 0.5 },
  { top: '78%', left: '50%', size: 4.5, delay: 0.8 },
  { top: '40%', left: '38%', size: 5, delay: 1.3 },
  { top: '15%', left: '58%', size: 4, delay: 0.1 },
  { top: '85%', left: '15%', size: 6, delay: 0.7 },
  { top: '28%', left: '80%', size: 4.5, delay: 1.0 },
  // 小星
  { top: '18%', left: '32%', size: 3, delay: 0.4 },
  { top: '62%', left: '58%', size: 3.5, delay: 1.2 },
  { top: '8%', left: '8%', size: 2.5, delay: 0.6 },
  { top: '75%', left: '88%', size: 3, delay: 0.9 },
  { top: '48%', left: '48%', size: 2.8, delay: 0.3 },
  { top: '30%', left: '68%', size: 3.5, delay: 1.5 },
  { top: '90%', left: '75%', size: 2.5, delay: 0.2 },
  { top: '5%', left: '52%', size: 3, delay: 0.8 },
  // 微星
  { top: '42%', left: '72%', size: 2, delay: 1.4 },
  { top: '15%', left: '90%', size: 1.8, delay: 0.5 },
  { top: '68%', left: '42%', size: 2, delay: 1.1 },
  { top: '25%', left: '12%', size: 2.2, delay: 0.7 },
  { top: '50%', left: '92%', size: 2.5, delay: 0.4 },
]

/** 生成闪烁动画 class（3 种不同节奏） */
function animClass(i: number) {
  return `twinkle-${(i % 3) + 1}`
}

export default function Splash() {
  useEffect(() => {
    const timer = setTimeout(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    }, 2800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <View className='splash'>
      {/* 星空背景 */}
      <View className='starfield'>
        {STARS.map((s, i) => (
          <View
            key={i}
            className={`star ${animClass(i)}`}
            style={{
              top: s.top,
              left: s.left,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
        {/* 中心光晕 */}
        <View className='center-glow' />
        {/* 中心大星 */}
        <View className='center-star' />
      </View>

      {/* 标题 */}
      <View className='title-wrapper'>
        <Text className='title'>群星闪耀</Text>
        <Text className='subtitle'>每一颗星都有自己的光</Text>
      </View>
    </View>
  )
}
