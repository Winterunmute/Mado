export type SourceType = 'rss' | 'youtube' | 'reddit'
export type ContentType = 'article' | 'video' | 'post' | 'image' | 'link'

export interface Feed {
  id?: string
  type?: SourceType
  url: string
  sourceUrl?: string
  title: string
  enabled: boolean
  lastFetched: string | null
  lastError?: string | null
  metadata?: Record<string, string>
}

export interface Article {
  id: string
  sourceId: string
  sourceType: SourceType
  contentType: ContentType
  author: string | null
  metadata: Record<string, string>
  title: string
  link: string
  pubDate: string
  description: string
  contentHtml?: string
  thumbnail: string | null
  feedTitle: string
  feedUrl: string
  isRead: boolean
}

export interface ReaderResult {
  title: string
  html: string
  byline: string | null
  url: string
  mode: 'extracted' | 'feed'
  notice: string | null
}

export interface Settings {
  theme: 'dark' | 'light'
  feedDensity: 'compact' | 'comfortable' | 'spacious'
  messengerWidth: number
  messengerVisible: boolean
  autoRefreshInterval: number
  showReadArticles: boolean
  trayEnabled: boolean
  closeToTray: boolean
  startMinimized: boolean
  messengerNotifications: boolean
  [key: string]: any
}

export interface ConversationTab {
  id: string
  key: string
  url: string
  label: string
  pinned: boolean
}

export interface MessengerLocation {
  url: string | null
  key: string | null
  isList: boolean
}

export interface DesktopState {
  trayActive: boolean
  closeToTray: boolean
  trayEnabled: boolean
  messengerNotifications: boolean
  messengerUnread: boolean
  windowState: {
    x: number | null
    y: number | null
    width: number
    height: number
    maximized: boolean
  } | null
}

export type ViewMode = 'feed' | 'sources' | 'settings'

export type FilterMode = 'all' | 'unread'
