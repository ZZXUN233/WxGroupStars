import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { AppProvider } from './store'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('群星闪耀 App launched.')
  })

  return <AppProvider>{children}</AppProvider>
}

export default App
