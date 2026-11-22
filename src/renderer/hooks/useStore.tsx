import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { filterFromPreference } from '../lib/article-filter'
import { api } from '../lib/api'
import type { Feed, Article, Settings, FilterMode, SourceType, Category, CustomFeedView, ContentType } from '../types'

interface StoreState {
  feeds: Feed[]
  articles: Article[]
  categories: Category[]
  views: CustomFeedView[]
  settings: Settings
  loading: boolean
  error: string | null
  filter: FilterMode
  searchQuery: string
  contentTypeFilter: ContentType | 'all'
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
  toggleSave: (item: Article) => Promise<void>
  createCategory: (name: string) => Promise<void>
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  assignCategories: (url: string, ids: string[]) => Promise<void>
  createView: (view: Partial<CustomFeedView>) => Promise<void>
  updateView: (id: string, view: Partial<CustomFeedView>) => Promise<void>
  deleteView: (id: string) => Promise<void>
  setFeedViewId: (id: string) => void
  setCategoryFilter: (id: string) => void
  setSourceTypeFilter: (type: SourceType | 'all') => void
  setSourceFilter: (id: string) => void
  setContentTypeFilter: (type: ContentType | 'all') => void
  setDateRange: (from: string, to: string) => void
  clearFilters: () => void
}

const StoreContext = createContext<StoreState | null>(null)

function keyOf(item: Article): string {
  return item.id || item.link
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [views, setViews] = useState<CustomFeedView[]>([])
  const [contentTypeFilter, setContentTypeFilterState] = useState<ContentType | 'all'>('all')
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
    feedViewId: 'all',
    feedFilterMode: 'all',
    feedCategoryFilter: 'all',
    feedSourceTypeFilter: 'all',
    feedSourceFilter: 'all',
    feedDateFrom: '',
    feedDateTo: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filter = filterFromPreference(settings)
  const readOverrides = useRef<Record<string, boolean>>({})
  const settingsQueue = useRef<Promise<unknown>>(Promise.resolve())
  const [searchQuery, setSearchQuery] = useState('')

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [feedsData, settingsData, categoriesData, viewsData] = await Promise.all([
        api.feeds.get(),
        api.settings.get(),
        api.categories.get(),
        api.views.get(),
      ])
      setFeeds(feedsData)
      setSettings(settingsData)
      setCategories(categoriesData)
      setViews(viewsData)
      const articlesData = await api.articles.get()
      setArticles(articlesData.map(a => ({ ...a, isRead: readOverrides.current[keyOf(a)] ?? a.isRead })))
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
      setArticles(articlesData.map(a => ({ ...a, isRead: readOverrides.current[keyOf(a)] ?? a.isRead })))
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

  const toggleSave = useCallback(async (item: Article) => {
    const key = keyOf(item)
    const next = !item.saved
    setArticles(prev => prev.map(a => keyOf(a) === key ? { ...a, saved: next } : a))
    try {
      if (next) await api.saved.save(item)
      else await api.saved.unsave(key)
    } catch (e: any) {
      setArticles(prev => prev.map(a => keyOf(a) === key ? { ...a, saved: !next } : a))
      setError(`Could not save item: ${e.message}`)
    }
  }, [])

  const categoryActions = {
    createCategory: async (name: string) => { setCategories((await api.categories.create(name)).categories); await refetch() },
    renameCategory: async (id: string, name: string) => { setCategories(await api.categories.rename(id, name)); await refetch() },
    deleteCategory: async (id: string) => {
      const result = await api.categories.remove(id)
      setCategories(result.categories)
      setFeeds(result.feeds)
      setSettings(prev => ({ ...prev, feedCategoryFilter: prev.feedCategoryFilter === id ? 'all' : prev.feedCategoryFilter }))
      await refetch()
    },
    assignCategories: async (url: string, ids: string[]) => { setFeeds(await api.categories.assign(url, ids)); await refetch() },
  }
  const viewActions = {
    createView: async (view: Partial<CustomFeedView>) => { setViews(await api.views.create(view)) },
    updateView: async (id: string, view: Partial<CustomFeedView>) => { setViews(await api.views.update(id, view)) },
    deleteView: async (id: string) => {
      setViews(await api.views.remove(id))
      setSettings(prev => ({ ...prev, feedViewId: prev.feedViewId === id ? 'all' : prev.feedViewId }))
    },
  }
  const setContentTypeFilter = useCallback((type: ContentType | 'all') => setContentTypeFilterState(type), [])
  const setDateRange = useCallback((from: string, to: string) => {
    setSettings(prev => ({ ...prev, feedDateFrom: from, feedDateTo: to }))
    void api.settings.set('feedDateFrom', from)
    void api.settings.set('feedDateTo', to)
  }, [])
  const clearFilters = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      feedFilterMode: 'all', showReadArticles: true,
      feedCategoryFilter: 'all', feedSourceTypeFilter: 'all', feedSourceFilter: 'all',
      feedViewId: 'all', feedDateFrom: '', feedDateTo: '',
    }))
    setContentTypeFilterState('all')
    setSearchQuery('')
    for (const key of ['feedFilterMode', 'showReadArticles', 'feedCategoryFilter', 'feedSourceTypeFilter', 'feedSourceFilter', 'feedViewId', 'feedDateFrom', 'feedDateTo']) {
      const value = key === 'feedFilterMode' ? 'all' : key === 'showReadArticles' ? true : key === 'feedDateFrom' || key === 'feedDateTo' ? '' : 'all'
      void api.settings.set(key, value)
    }
  }, [])

  const value: StoreState = {
    feeds,
    articles,
    categories,
    views,
    settings,
    loading,
    error,
    filter,
    searchQuery,
    contentTypeFilter,
    refetch,
    setFilter: (mode) => {
      handleSetSetting('feedFilterMode', mode)
      handleSetSetting('showReadArticles', mode !== 'unread')
    },
    markRead,
    markAllRead,
    toggleSave,
    ...categoryActions,
    ...viewActions,
    setFeedViewId: (id) => handleSetSetting('feedViewId', id),
    setCategoryFilter: (id) => handleSetSetting('feedCategoryFilter', id),
    setSourceTypeFilter: (type) => handleSetSetting('feedSourceTypeFilter', type),
    setSourceFilter: (id) => handleSetSetting('feedSourceFilter', id),
    setContentTypeFilter,
    setDateRange,
    clearFilters,
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

export function useOrganize() {
  const store = useStore()
  return {
    categories: store.categories, views: store.views,
    createCategory: store.createCategory, renameCategory: store.renameCategory, deleteCategory: store.deleteCategory,
    assignCategories: store.assignCategories,
    createView: store.createView, updateView: store.updateView, deleteView: store.deleteView,
    feedViewId: store.settings.feedViewId, setFeedViewId: store.setFeedViewId,
    setCategoryFilter: store.setCategoryFilter,
  }
}

export function useTheme() {
  const { settings: { theme }, setTheme } = useStore()
  return { theme, setTheme }
}
