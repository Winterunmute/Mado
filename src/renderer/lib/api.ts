import type { Feed, Article, Settings, ReaderResult, ConversationTab, MessengerLocation, DesktopState, SourceType, Category, CustomFeedView, DiscoveryResult, OpmlImportSummary, UpdateCheckResult } from '../types'

declare global {
  interface Window {
    electronAPI: {
      feeds: {
        get: () => Promise<Feed[]>
        add: (input: string, type?: SourceType) => Promise<Feed>
        remove: (url: string) => Promise<Feed[]>
        toggle: (url: string) => Promise<Feed[]>
        refresh: (url?: string) => Promise<Article[]>
        updateTitle: (url: string, title: string) => Promise<Feed[]>
      }
      articles: {
        read: (id: string) => Promise<ReaderResult>
        get: () => Promise<Article[]>
        markRead: (id: string) => Promise<Record<string, boolean>>
        markUnread: (id: string) => Promise<Record<string, boolean>>
        markAllRead: (ids: string[]) => Promise<Record<string, boolean>>
      }
      settings: {
        get: () => Promise<Settings>
        set: (key: string, value: any) => Promise<Settings>
      }
      messenger: {
        getStatus: () => Promise<{ loaded: boolean }>
        setVisible: (visible: boolean) => Promise<boolean>
        setWidth: (width: number) => Promise<number>
        reload: () => Promise<void>
        backToMessenger: () => Promise<void>
        goBack: () => Promise<void>
        goForward: () => Promise<void>
        onLoadError: (callback: (data: any) => void) => () => void
        onLoaded: (callback: () => void) => () => void
        onVisibilityChanged: (callback: (visible: boolean) => void) => () => void
        onNavigationBlocked: (callback: (url: string) => void) => () => void
        getLocation: () => Promise<MessengerLocation>
        navigate: (url: string) => Promise<void>
        onLocationChanged: (callback: (location: MessengerLocation) => void) => () => void
        markSeen: () => Promise<void>
        onUnreadChanged: (callback: (state: { active: boolean; count: number }) => void) => () => void
      }
      desktop: {
        getState: () => Promise<DesktopState>
        onStateChanged: (callback: (state: DesktopState) => void) => () => void
        onShortcut: (callback: (action: string) => void) => () => void
      }
      conversationTabs: {
        get: () => Promise<ConversationTab[]>
        save: (tabs: ConversationTab[]) => Promise<ConversationTab[]>
      }
      categories: {
        get: () => Promise<Category[]>
        create: (name: string) => Promise<{ categories: Category[]; category: Category | null }>
        rename: (id: string, name: string) => Promise<Category[]>
        remove: (id: string) => Promise<{ categories: Category[]; feeds: Feed[] }>
        assign: (url: string, ids: string[]) => Promise<Feed[]>
      }
      saved: {
        get: () => Promise<Record<string, Article>>
        save: (item: Article) => Promise<Article | null>
        unsave: (key: string) => Promise<Record<string, Article>>
      }
      views: {
        get: () => Promise<CustomFeedView[]>
        create: (value: Partial<CustomFeedView>) => Promise<CustomFeedView[]>
        update: (id: string, value: Partial<CustomFeedView>) => Promise<CustomFeedView[]>
        remove: (id: string) => Promise<CustomFeedView[]>
      }
      sources: {
        discover: (input: string) => Promise<DiscoveryResult>
      }
      opml: {
        import: () => Promise<OpmlImportSummary | null>
        export: () => Promise<string | null>
      }
      config: {
        export: () => Promise<string | null>
      }
      updates: {
        check: () => Promise<UpdateCheckResult>
        open: (url: string) => Promise<void>
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
      app: {
        reset: () => Promise<void>
      }
    }
  }
}

export const api = window.electronAPI
