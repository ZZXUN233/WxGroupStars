import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '../types'
import { getMe } from '../api'

interface AppState {
  /** 当前登录用户；未登录为 null */
  user: User | null
  ready: boolean
  refreshUser: () => Promise<void>
}

const AppContext = createContext<AppState>({ user: null, ready: false, refreshUser: async () => {} })

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      // getMe 每次查后端最新资料，避免 login 的 lastSession 缓存导致昵称/头像过期
      const res = await getMe()
      setUser(res.data)
    } catch {
      setUser(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const value = useMemo(() => ({ user, ready, refreshUser }), [user, ready, refreshUser])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
