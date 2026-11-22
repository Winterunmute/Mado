import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  feeds: {
    get: () => ipcRenderer.invoke('feeds:get'),
    add: (input: string, type?: string) => ipcRenderer.invoke('feeds:add', input, type),
    remove: (url: string) => ipcRenderer.invoke('feeds:remove', url),
    toggle: (url: string) => ipcRenderer.invoke('feeds:toggle', url),
    refresh: (url?: string) => ipcRenderer.invoke('feeds:refresh', url),
    updateTitle: (url: string, title: string) => ipcRenderer.invoke('feeds:update-title', url, title),
  },
  articles: {
    read: (id: string) => ipcRenderer.invoke('articles:read', id),
    get: () => ipcRenderer.invoke('articles:get'),
    markRead: (id: string) => ipcRenderer.invoke('articles:mark-read', id),
    markUnread: (id: string) => ipcRenderer.invoke('articles:mark-unread', id),
    markAllRead: (ids: string[]) => ipcRenderer.invoke('articles:mark-all-read', ids),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },
  messenger: {
    getStatus: () => ipcRenderer.invoke('messenger:status'),
    setVisible: (visible: boolean) => ipcRenderer.invoke('messenger:set-visible', visible),
    setWidth: (width: number) => ipcRenderer.invoke('messenger:set-width', width),
    reload: () => ipcRenderer.invoke('messenger:reload'),
    backToMessenger: () => ipcRenderer.invoke('messenger:back-to-messenger'),
    goBack: () => ipcRenderer.invoke('messenger:go-back'),
    goForward: () => ipcRenderer.invoke('messenger:go-forward'),
    onLoadError: (callback: (data: any) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('messenger-load-error', handler)
      return () => ipcRenderer.removeListener('messenger-load-error', handler)
    },
    onLoaded: (callback: () => void) => {
      ipcRenderer.on('messenger-loaded', callback)
      return () => ipcRenderer.removeListener('messenger-loaded', callback)
    },
    onVisibilityChanged: (callback: (visible: boolean) => void) => {
      const handler = (_e: any, visible: boolean) => callback(visible)
      ipcRenderer.on('messenger-visibility-changed', handler)
      return () => ipcRenderer.removeListener('messenger-visibility-changed', handler)
    },
    onNavigationBlocked: (callback: (url: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, url: string) => callback(url)
      ipcRenderer.on('messenger-navigation-blocked', handler)
      return () => ipcRenderer.removeListener('messenger-navigation-blocked', handler)
    },
    getLocation: () => ipcRenderer.invoke('messenger:get-location'),
    navigate: (url: string) => ipcRenderer.invoke('messenger:navigate', url),
    onLocationChanged: (callback: (location: any) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, location: any) => callback(location)
      ipcRenderer.on('messenger-location-changed', handler)
      return () => ipcRenderer.removeListener('messenger-location-changed', handler)
    },
    markSeen: () => ipcRenderer.invoke('messenger:mark-seen'),
    onUnreadChanged: (callback: (state: any) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, state: any) => callback(state)
      ipcRenderer.on('messenger-unread-changed', handler)
      return () => ipcRenderer.removeListener('messenger-unread-changed', handler)
    },
  },
  desktop: {
    getState: () => ipcRenderer.invoke('desktop:get-state'),
    onStateChanged: (callback: (state: any) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, state: any) => callback(state)
      ipcRenderer.on('desktop-state-changed', handler)
      return () => ipcRenderer.removeListener('desktop-state-changed', handler)
    },
    onShortcut: (callback: (action: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, action: string) => callback(action)
      ipcRenderer.on('shortcut', handler)
      return () => ipcRenderer.removeListener('shortcut', handler)
    },
  },
  conversationTabs: {
    get: () => ipcRenderer.invoke('messenger-tabs:get'),
    save: (tabs: any) => ipcRenderer.invoke('messenger-tabs:save', tabs),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  app: {
    reset: () => ipcRenderer.invoke('app:reset'),
  },
})

contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
})
