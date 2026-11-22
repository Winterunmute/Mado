import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { filterFromPreference } from '../lib/article-filter'
import { api } from '../lib/api'
import type { Feed, Article, Settings, FilterMode, SourceType } from '../types'

interface StoreState {
  feeds: Feed[]
  articles: Article[]
  settings: Settings
  loading: boolean
  error: string | null
  filter: FilterMode
  searchQuery: string
  refetch: () => Promise<void>
  setFilter: (filter: FilterMode) => void
  setSearchQuery: (query: string) => void
  addFeed: (input: string, type?: SourceType) => Promise<Feed>
  removeFeed: (url: string) => Promise<void>
  toggleFeed: (url: string) => Promise<void>
  refreshFeeds: (url?: string) => Promise<void>
  setTheme: (theme: 'dark' | 'light') => void
  setFeedDensity: (density: Settings['feedDensity']) => void
  setMessengerWidth: (width: number) => void
  setMessengerVisible: (visible: boolean) => void
  setAutoRefreshInterval: (interval: number) => void
  setShowReadArticles: (show: boolean) => void
  setTrayEnabled: (enabled: boolean) => void
  setCloseToTray: (enabled: boolean) => void
  setStartMinimized: (enabled: boolean) => void
  setMessengerNotifications: (enabled: boolean) => void
  markRead: (id: string, read: boolean) => Promise<void>
  markAllRead: (ids: string[]) => Promise<void>
}

const StoreContext = createContext<StoreState | null>(null)

function keyOf(item: Article): string {
  return item.id || item.link
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [settings, setSettings] = useState<Settings>({
    theme: 'dark',
    feedDensity: 'comfortable',
    messengerWidth: 420,
    messengerVisible: true,
    autoRefreshInterval: 0,
    showReadArticles: true,
    trayEnabled: false,
    closeToTray: false,
    startMinimized: false,
    messengerNotifications: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filter = filterFromPreference(settings.showReadArticles)
  const readOverrides = useRef<Record<string, boolean>>({})
  const settingsQueue = useRef<Promise<unknown>>(Promise.resolve())
  const [searchQuery, setSearchQuery] = useState('')

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [feedsData, settingsData] = await Promise.all([
        api.feeds.get(),
        api.settings.get(),
      ])
      setFeeds(feedsData)
      setSettings(settingsData)
      const articlesData = await api.articles.get()
      setArticles(articlesData.map(a => ({ ...a, isRead: readOverrides.current[a.link] ?? a.isRead })))
    } catch (e: any) {
      setError(e.message || 'Failed to load data')
    } finally {
      try { setFeeds(await api.feeds.get()) } catch { /* Keep the last known subscriptions. */ }
      setLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const articlesData = await api.articles.get()
      setArticles(articlesData.map(a => ({ ...a, isRead: readOverrides.current[a.link] ?? a.isRead })))
    } catch (e: any) {
      setError(e.message || 'Failed to refresh')
    } finally {
      try { setFeeds(await api.feeds.get()) } catch { /* Keep the last known subscriptions. */ }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.style.colorScheme = settings.theme
  }, [settings.theme])

  useEffect(() => {
    if (!settings.autoRefreshInterval) return
    let hidden = document.hidden
    const onVisibility = () => { hidden = document.hidden }
    document.addEventListener('visibilitychange', onVisibility)
    // No background network activity while Mado is hidden in the tray.
    const timer = window.setInterval(() => { if (!hidden) void refetch() }, settings.autoRefreshInterval)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [settings.autoRefreshInterval, refetch])

  const handleAddFeed = useCallback(async (url: string, type?: SourceType) => {
    const newFeed = await api.feeds.add(url, type)
    setFeeds(prev => [...prev, newFeed])
    await refetch()
    return newFeed
  }, [refetch])

  const handleRemoveFeed = useCallback(async (url: string) => {
    await api.feeds.remove(url)
    setFeeds(prev => prev.filter(f => f.url !== url))
    await refetch()
  }, [refetch])

  const handleToggleFeed = useCallback(async (url: string) => {
    const updated = await api.feeds.toggle(url)
    setFeeds(updated)
    await refetch()
  }, [refetch])

  const handleRefreshFeeds = useCallback(async (url?: string) => {
    await api.feeds.refresh(url)
    await refetch()
  }, [refetch])

  const handleSetSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    settingsQueue.current = settingsQueue.current.then(() => api.settings.set(String(key), value)).catch((e) => {
      setError(`Could not save preference: ${e.message}`)
    })
  }, [])

  const markRead = useCallback(async (id: string, read: boolean) => {
    const previous = articles.find(a => keyOf(a) === id)?.isRead ?? false
    readOverrides.current[id] = read
    setArticles(prev => prev.map(a => keyOf(a) === id ? { ...a, isRead: read } : a))
    try {
      await (read ? api.articles.markRead(id) : api.articles.markUnread(id))
    } catch (e: any) {
      readOverrides.current[id] = previous
      setArticles(prev => prev.map(a => keyOf(a) === id ? { ...a, isRead: previous } : a))
      setError(`Could not save read status: ${e.message}`)
    }
  }, [articles])

  const markAllRead = useCallback(async (ids: string[]) => {
    try {
      const state = await api.articles.markAllRead(ids)
      for (const id of ids) readOverrides.current[id] = state[id] === true
      setArticles(prev => prev.map(a => ids.includes(keyOf(a)) ? { ...a, isRead: true } : a))
    } catch (e: any) { setError(`Could not mark articles read: ${e.message}`) }
  }, [])

  const value: StoreState = {
    feeds,
    articles,
    settings,
    loading,
    error,
    filter,
    searchQuery,
    refetch,
    setFilter: (mode) => handleSetSetting('showReadArticles', mode === 'all'),
    markRead,
    markAllRead,
    setSearchQuery,
    addFeed: handleAddFeed,
    removeFeed: handleRemoveFeed,
    toggleFeed: handleToggleFeed,
    refreshFeeds: handleRefreshFeeds,
    setTheme: (theme) => handleSetSetting('theme', theme),
    setFeedDensity: (density) => handleSetSetting('feedDensity', density),
    setMessengerWidth: (width) => handleSetSetting('messengerWidth', width),
    setMessengerVisible: (visible) => handleSetSetting('messengerVisible', visible),
    setAutoRefreshInterval: (interval) => handleSetSetting('autoRefreshInterval', interval),
    setShowReadArticles: (show) => handleSetSetting('showReadArticles', show),
    setTrayEnabled: (enabled) => handleSetSetting('trayEnabled', enabled),
    setCloseToTray: (enabled) => handleSetSetting('closeToTray', enabled),
    setStartMinimized: (enabled) => handleSetSetting('startMinimized', enabled),
    setMessengerNotifications: (enabled) => handleSetSetting('messengerNotifications', enabled),
  }

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used within StoreProvider')
  return context
}

export function useArticles() {
  const { articles, loading, error, refetch, filter, setFilter, searchQuery, setSearchQuery } = useStore()
  return { articles, loading, error, refetch, filter, setFilter, searchQuery, setSearchQuery }
}

export function useFeeds() {
  const { feeds, loading, error, refetch, addFeed, removeFeed, toggleFeed, refreshFeeds } = useStore()
  return { feeds, loading, error, refetch, addFeed, removeFeed, toggleFeed, refreshFeeds }
}

export function useSettings() {
  const { settings, setTheme, setFeedDensity, setMessengerWidth, setMessengerVisible, setAutoRefreshInterval, setShowReadArticles, setTrayEnabled, setCloseToTray, setStartMinimized, setMessengerNotifications } = useStore()
  return { 
    ...settings, 
    setTheme, 
    setFeedDensity, 
    setMessengerWidth, 
    setMessengerVisible, 
    setAutoRefreshInterval, 
    setShowReadArticles,
    setTrayEnabled,
    setCloseToTray,
    setStartMinimized,
    setMessengerNotifications,
  }
}

export function useFeedActions() {
  const { feeds, addFeed, removeFeed, toggleFeed, refreshFeeds } = useStore()
  return { feeds, addFeed, removeFeed, toggleFeed, refreshFeeds }
}

export function useTheme() {
  const { settings: { theme }, setTheme } = useStore()
  return { theme, setTheme }
}
