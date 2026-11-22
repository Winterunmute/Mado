import { app, BrowserWindow, dialog, ipcMain, shell, WebContentsView, IpcMainInvokeEvent, WebContents, nativeTheme, Notification, screen, session } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { messengerStyle } from './messenger-style.js'
import { publicWebUrl, isPublicAddress } from './reader-content.js'
import { lookup } from 'node:dns'
import { join } from 'path'
import { readFeeds, writeFeeds, readReadState, updateReadState, readSettings, writeSettings, readConversationTabs, writeConversationTabs, readWindowState, writeWindowState, isAllowedSettingKey, resetApplicationData, readCategories, createCategory, renameCategory, deleteCategory, assignCategories, readSaved, saveContent, unsaveContent, readViews, createView, updateView, deleteView } from './store.js'
import { fetchFeed } from './rss.js'
import { clearSourceCache, fetchSource, fetchSourcesConcurrently } from './sources/index.js'
import { dedupeContent, isReadInState, sourceId, type SourceType } from './sources/model.js'
import { resolveYouTubeChannelAsync } from './sources/youtube-adapter.js'
import { redditFeedError, resolveRedditCommunity } from './sources/reddit-adapter.js'
import { discoverSources } from './organize/discovery.js'
import { parseOpml, buildOpml } from './organize/opml.js'
import { categoryNameMap } from './organize/categories.js'
import {
  classifyMessengerNavigation,
  isMessengerAuthenticationUrl,
  isMessengerContentUrl,
} from './messenger-navigation.js'
import { locationFromUrl, type MessengerLocation } from './conversation-tabs.js'
import { DEFAULT_WINDOW_STATE, resolveWindowBounds, stateFromBounds, type WindowState } from './window-state.js'
import { actionForInput } from './shortcuts.js'
import { shouldShowUnreadNotification, unreadCountFromTitle } from './notification-policy.js'
import { createOrUpdateTray, destroyTray, isTrayActive, setTrayUnread, trayIconPaths } from './tray.js'
import { checkForUpdates, configuredRelease } from './updates.js'

const __dirname = import.meta.dirname
const ICONS = trayIconPaths()
app.setAppUserModelId('com.mado.app')

const TITLEBAR_HEIGHT = 36
const MESSENGER_HEADER_HEIGHT = 44

let mainWindow: BrowserWindow | null = null
let messengerView: WebContentsView | null = null
let isMessengerVisible = true
let messengerWidth = 420
let hasReachedMessenger = false
let messengerAuthenticationInProgress = false
let messengerLoaded = false
let windowState: WindowState | null = null
let isQuitting = false
let windowStateTimer: NodeJS.Timeout | null = null
let trayEnabled = false
let closeToTray = false
let messengerNotifications = false
let startMinimized = false
let messengerUnread = 0
let lastNotifiedUnread = 0
let lastNotifiedAt = 0
const readerSources = new Map<string, { title: string; link: string; description: string; contentHtml?: string }>()
const readerCache = new Map<string, Promise<import('./reader.js').ReaderResult>>()

// User interaction is required for media playback in any embedded surface.
app.commandLine.appendSwitch('autoplay-policy', 'document-user-activation-required')

let messengerCssKey: string | null = null
let themeQueue: Promise<void> = Promise.resolve()
async function applyTheme() {
  const { theme } = await readSettings()
  nativeTheme.themeSource = theme
  mainWindow?.setBackgroundColor(theme === 'dark' ? '#0f0f1a' : '#fafafa')
  mainWindow?.setTitleBarOverlay({ color: theme === 'dark' ? '#1a1a2e' : '#ffffff', symbolColor: theme === 'dark' ? '#ffffff' : '#18181b' })
  const wc = messengerView?.webContents
  if (!wc || wc.isDestroyed()) return
  if (messengerCssKey) await wc.removeInsertedCSS(messengerCssKey).catch(() => {})
  messengerCssKey = null
  if (isMessengerContentUrl(wc.getURL())) messengerCssKey = await wc.insertCSS(messengerStyle(theme))
}
function scheduleTheme() {
  themeQueue = themeQueue.then(applyTheme).catch(error => console.error('[Theme]', error))
}

async function openExternalUrl(url: string) {
  const parsedUrl = new URL(url)
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS links can be opened externally')
  }
  if (parsedUrl.username || parsedUrl.password) throw new Error('Links with embedded credentials are not supported')
  await shell.openExternal(parsedUrl.toString())
}

// Only validated Messenger content URLs are ever sent to the renderer. Never
// publish authentication URLs, redirectors or arbitrary navigation targets.
function currentMessengerLocation(): MessengerLocation {
  try {
    if (!messengerView || messengerView.webContents.isDestroyed()) {
      return { url: null, key: null, isList: false }
    }
    const url = messengerView.webContents.getURL()
    const decision = classifyMessengerNavigation(url)
    if (decision.kind !== 'allow' || !isMessengerContentUrl(decision.url)) {
      return { url: null, key: null, isList: false }
    }
    return locationFromUrl(decision.url)
  } catch {
    return { url: null, key: null, isList: false }
  }
}

function publishMessengerLocation() {
  mainWindow?.webContents.send('messenger-location-changed', currentMessengerLocation())
}

function captureWindowState() {
  if (!mainWindow || isQuitting) return
  const maximized = mainWindow.isMaximized()
  windowState = stateFromBounds(mainWindow.getNormalBounds(), maximized)
  void writeWindowState(windowState).catch(error => console.error('[WindowState]', error))
}

function scheduleWindowStateSave() {
  if (windowStateTimer) clearTimeout(windowStateTimer)
  windowStateTimer = setTimeout(() => { windowStateTimer = null; captureWindowState() }, 400)
}

function showMainWindow() {
  if (!mainWindow) { createWindow(); return }
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function hideMainWindow() {
  mainWindow?.hide()
}

function focusMessenger() {
  showMainWindow()
  if (!isMessengerVisible) void setMessengerVisible(true)
  setMessengerUnread(0)
  messengerView?.webContents.focus()
}

function syncTray() {
  if (trayEnabled || closeToTray) {
    createOrUpdateTray({
      ...ICONS,
      onShow: showMainWindow,
      onHide: hideMainWindow,
      onQuit: () => { isQuitting = true; app.quit() },
    })
    setTrayUnread(messengerUnread > 0, ICONS.smallIconPath, ICONS.smallUnreadIconPath)
  } else {
    destroyTray()
  }
}

function publishDesktopState() {
  mainWindow?.webContents.send('desktop-state-changed', {
    trayActive: isTrayActive(),
    messengerUnread: messengerUnread > 0,
  })
}

function setMessengerUnread(count: number) {
  messengerUnread = Math.max(0, Math.min(99, count))
  setTrayUnread(messengerUnread > 0, ICONS.smallIconPath, ICONS.smallUnreadIconPath)
  mainWindow?.webContents.send('messenger-unread-changed', { active: messengerUnread > 0, count: messengerUnread })
}

function showUnreadNotification() {
  if (!messengerNotifications || messengerUnread <= 0) return
  const notification = new Notification({
    title: 'Messenger',
    body: 'You have new Messenger activity.',
    icon: ICONS.iconPath,
  })
  notification.on('click', focusMessenger)
  notification.show()
}

function handleMessengerTitle(title: string) {
  const count = unreadCountFromTitle(title)
  const previous = messengerUnread
  setMessengerUnread(count)
  const messengerFocused = !!mainWindow?.isFocused() && isMessengerVisible && (messengerView?.webContents.isFocused() ?? false)
  if (shouldShowUnreadNotification({
    enabled: messengerNotifications,
    count,
    previousCount: previous,
    messengerFocused,
    now: Date.now(),
    lastNotifiedAt: lastNotifiedAt,
  })) {
    lastNotifiedAt = Date.now()
    lastNotifiedUnread = count
    showUnreadNotification()
  }
}

function dispatchShortcut(action: string) {
  showMainWindow()
  mainWindow?.webContents.send('shortcut', action)
}

function registerShortcuts(contents: WebContents, allowEscape: boolean) {
  contents.on('before-input-event', (event, input) => {
    const action = actionForInput(input)
    if (!action || (action === 'back-from-reader' && !allowEscape)) return
    event.preventDefault()
    dispatchShortcut(action)
  })
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow()
    return
  }

  const displays = screen.getAllDisplays().map(display => ({ id: display.id, workArea: display.workArea }))
  const bounds = resolveWindowBounds(windowState ?? DEFAULT_WINDOW_STATE, displays, screen.getPrimaryDisplay().id)

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1000,
    minHeight: 700,
    title: 'Mado — Your window to the world.',
    icon: ICONS.smallIconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#ffffff',
      height: 36,
    },
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f0f1a',
    show: false,
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (windowState?.maximized) mainWindow.maximize()
  registerShortcuts(mainWindow.webContents, true)

  mainWindow.once('ready-to-show', () => {
    if (startMinimized && (trayEnabled || closeToTray)) mainWindow?.hide()
    else mainWindow?.show()
    initializeMessenger()
    publishDesktopState()
  })

  mainWindow.on('close', event => {
    if (isQuitting) return
    if (!closeToTray) { isQuitting = true; return }
    event.preventDefault()
    hideMainWindow()
  })

  mainWindow.on('closed', () => {
    if (windowStateTimer) { clearTimeout(windowStateTimer); windowStateTimer = null }
    mainWindow = null
    messengerView = null
  })

  mainWindow.on('resize', () => { updateMessengerBounds(); scheduleWindowStateSave() })
  mainWindow.on('move', scheduleWindowStateSave)
  mainWindow.on('maximize', scheduleWindowStateSave)
  mainWindow.on('unmaximize', scheduleWindowStateSave)
  // Article image redirects are checked as well as their initial sanitized URLs.
  // This session is separate from persist:messenger; Messenger traffic is untouched.
  mainWindow.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    if (details.webContentsId !== mainWindow?.webContents.id || details.resourceType !== 'image') { callback({}); return }
    const safeUrl = publicWebUrl(details.url)
    if (!safeUrl) { callback({ cancel: true }); return }
    lookup(new URL(safeUrl).hostname.replace(/^\[|\]$/g, ''), { all: true }, (error, addresses) => {
      callback({ cancel: !!error || !addresses.length || addresses.some(address => !isPublicAddress(address.address)) })
    })
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    void openExternalUrl(url).catch(error => console.error('[Navigation]', error.message))
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url).catch(error => console.error('[Navigation]', error.message))
    return { action: 'deny' }
  })
}

async function initializeMessenger() {
  if (!mainWindow) return
  if (messengerView && !messengerView.webContents.isDestroyed()) return

  const settings = await readSettings()
  if (!mainWindow) return
  isMessengerVisible = settings.messengerVisible
  messengerWidth = Number.isFinite(settings.messengerWidth)
    ? Math.max(320, Math.min(600, settings.messengerWidth))
    : 420

  // Web notifications are denied so Facebook cannot duplicate our privacy-safe
  // native notification. Other permissions keep Chromium's default behaviour.
  session.fromPartition('persist:messenger').setPermissionCheckHandler((_wc, permission) => permission !== 'notifications')

  messengerView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, 'messenger-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      partition: 'persist:messenger',
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  })

  messengerView.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  )

  const wc = messengerView.webContents as any

  registerShortcuts(messengerView.webContents, false)
  wc.on('page-title-updated', (_event: Electron.Event, title: string) => handleMessengerTitle(title))

  wc.on('dom-ready', () => {
    messengerCssKey = null
    scheduleTheme()
  })

  wc.on('did-fail-load', (_event: Electron.Event, errorCode: number, errorDescription: string, validatedURL: string, isMainFrame: boolean) => {
    if (!isMainFrame || errorCode === -3) return
    messengerLoaded = false
    if (messengerView && mainWindow?.contentView.children.includes(messengerView)) {
      mainWindow.contentView.removeChildView(messengerView)
    }
    console.log('[Messenger] Load failed:', errorCode, errorDescription, validatedURL)
    mainWindow?.webContents.send('messenger-load-error', { errorCode, errorDescription, url: validatedURL })
  })

  wc.on('did-finish-load', () => {
    messengerLoaded = true
    if (isMessengerVisible && mainWindow && messengerView) {
      mainWindow.contentView.addChildView(messengerView)
      updateMessengerBounds()
    }
    console.log('[Messenger] Load finished')
    publishMessengerLocation()
    mainWindow?.webContents.send('messenger-loaded')
  })

  wc.on('login', (_event: Electron.Event, _webContents: WebContents, _request: any, authInfo: any, _callback: Function) => {
    console.log('[Messenger] Login requested for:', authInfo.realm)
  })

  wc.setWindowOpenHandler(({ url }: { url: string }) => {
    const decision = classifyMessengerNavigation(
      url,
      !hasReachedMessenger || messengerAuthenticationInProgress,
    )
    if (decision.kind === 'external') {
      openExternalUrl(decision.url).catch(error => {
        console.error('[Messenger] Could not open external link:', error)
      })
    } else if (decision.kind === 'allow' && messengerView) {
      messengerView.webContents.loadURL(decision.url).catch(error => {
        console.error('[Messenger] Could not open Messenger popup destination:', error)
      })
    } else {
      reportBlockedMessengerNavigation(decision.url)
    }
    return { action: 'deny' }
  })

  wc.on('will-navigate', (event: Electron.Event, url: string) => {
    handleMessengerNavigation(event, url)
  })

  wc.on('will-redirect', (
    event: Electron.Event,
    url: string,
    _isInPlace: boolean,
    isMainFrame: boolean,
  ) => {
    if (isMainFrame) handleMessengerNavigation(event, url)
  })

  wc.on('did-navigate', (_event: Electron.Event, url: string) => {
    recoverFromUnexpectedMessengerNavigation(url)
    publishMessengerLocation()
  })

  wc.on('did-navigate-in-page', (
    _event: Electron.Event,
    url: string,
    isMainFrame: boolean,
  ) => {
    if (isMainFrame) {
      recoverFromUnexpectedMessengerNavigation(url)
      publishMessengerLocation()
    }
  })

  if (isMessengerVisible) mainWindow.contentView.addChildView(messengerView)
  loadMessenger()
  updateMessengerBounds()
}

function loadMessenger() {
  if (!messengerView) return
  messengerLoaded = false
  messengerView.webContents.loadURL('https://www.facebook.com/messages/', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  }).catch(error => console.error('[Messenger] Load failed:', error.message))
}

function updateMessengerBounds() {
  if (!mainWindow || !messengerView) return

  const { width, height } = mainWindow.getContentBounds()
  const panelWidth = Math.min(messengerWidth, width)
  const resizeHandleWidth = 8
  const headerHeight = TITLEBAR_HEIGHT + MESSENGER_HEADER_HEIGHT

  messengerView.setBounds({
    x: width - panelWidth + resizeHandleWidth,
    y: headerHeight,
    width: Math.max(0, panelWidth - resizeHandleWidth),
    height: Math.max(0, height - headerHeight),
  })
}

function setMessengerVisible(visible: boolean) {
  isMessengerVisible = visible
  if (!mainWindow || !messengerView) return

  if (visible) {
    if (!mainWindow.contentView.children.includes(messengerView)) {
      mainWindow.contentView.addChildView(messengerView)
    }
    updateMessengerBounds()
    publishMessengerLocation()
    if (!messengerView.webContents.isLoading()) {
      mainWindow.webContents.send('messenger-loaded')
    }
  } else {
    mainWindow.contentView.removeChildView(messengerView)
  }
  mainWindow.webContents.send('messenger-visibility-changed', visible)
}

function setMessengerWidth(width: number) {
  messengerWidth = Math.max(320, Math.min(600, width))
  if (!mainWindow || !messengerView) return
  updateMessengerBounds()
}

function reportBlockedMessengerNavigation(url: string) {
  mainWindow?.webContents.send('messenger-navigation-blocked', url)
}

function handleMessengerNavigation(event: Electron.Event, rawUrl: string) {
  const decision = classifyMessengerNavigation(
    rawUrl,
    !hasReachedMessenger || messengerAuthenticationInProgress,
  )
  if (decision.kind === 'allow') {
    if (isMessengerAuthenticationUrl(decision.url)) messengerAuthenticationInProgress = true
    if (isMessengerContentUrl(decision.url)) {
      hasReachedMessenger = true
      messengerAuthenticationInProgress = false
    }
    return
  }

  event.preventDefault()
  reportBlockedMessengerNavigation(decision.url)

  if (decision.kind === 'external') {
    openExternalUrl(decision.url).catch(error => {
      console.error('[Messenger] Could not open external link:', error)
    })
  }
}

function recoverFromUnexpectedMessengerNavigation(rawUrl: string) {
  scheduleTheme()
  const decision = classifyMessengerNavigation(
    rawUrl,
    !hasReachedMessenger || messengerAuthenticationInProgress,
  )
  if (decision.kind === 'allow') {
    if (isMessengerAuthenticationUrl(decision.url)) messengerAuthenticationInProgress = true
    if (isMessengerContentUrl(decision.url)) {
      hasReachedMessenger = true
      messengerAuthenticationInProgress = false
    }
    return
  }

  reportBlockedMessengerNavigation(decision.url)
  if (decision.kind === 'external') {
    openExternalUrl(decision.url).catch(error => {
      console.error('[Messenger] Could not open external link:', error)
    })
  }
  loadMessenger()
}

async function getAllArticles(force = false): Promise<any[]> {
  const feeds = await readFeeds()
  const enabledFeeds = feeds.filter(feed => feed.enabled)
  const results = await fetchSourcesConcurrently(enabledFeeds, force)
  // Read after network completion so a refresh cannot resurrect newly read articles.
  const readState = await readReadState()
  const saved = await readSaved()
  const savedKeys = new Set(Object.keys(saved))
  const allArticles: any[] = []
  let failedFeeds = 0

  for (const feed of enabledFeeds) {
    const result = results.get(feed.id)
    if (!result) {
      failedFeeds += 1
      continue
    }
    if (result.error) failedFeeds += 1
    // On failure this contains the last successful fetch, so previous content
    // remains visible even though the source error is surfaced separately.
    for (const item of result.items) allArticles.push({
      ...item,
      isRead: isReadInState(readState, item),
      saved: savedKeys.has(item.id) || savedKeys.has(item.link),
      categoryIds: feed.categoryIds || [],
      available: true,
    })
  }

  const latestFeeds = await readFeeds()
  for (const feed of latestFeeds) {
    const result = results.get(feed.id)
    if (result && !result.error && enabledFeeds.some(enabled => enabled.id === feed.id)) {
      feed.lastFetched = new Date().toISOString()
      feed.lastError = null
    } else if (result?.error && feed.enabled) {
      feed.lastError = feed.type === 'reddit' ? redditFeedError(new Error(result.error)) : result.error
    }
  }
  await writeFeeds(latestFeeds)
  if (enabledFeeds.length > 0 && failedFeeds === enabledFeeds.length) {
    if (enabledFeeds.every(feed => feed.type === 'reddit')) {
      throw new Error('Reddit is not providing feed data from this network. Your subscriptions were kept; use Open on Reddit or retry later.')
    }
    throw new Error('Unable to load any enabled sources. Check your connection or source URLs and retry.')
  }

  const deduped: any[] = dedupeContent(allArticles) as any[]
  const seenLinks = new Set(deduped.map(item => item.link))
  const seenIds = new Set(deduped.map(item => item.id))
  for (const item of Object.values(saved)) {
    if (seenIds.has(item.id) || seenLinks.has(item.link)) continue
    const source = feeds.find(feed => feed.id === item.sourceId || feed.url === item.feedUrl)
    deduped.push({
      ...item,
      isRead: isReadInState(readState, item as any),
      saved: true,
      available: false,
      categoryIds: source?.categoryIds || [],
    })
    seenIds.add(item.id)
    seenLinks.add(item.link)
  }
  readerSources.clear()
  for (const item of deduped) {
    readerSources.set(item.link, item)
    if (item.id) readerSources.set(item.id, item as any)
  }
  return deduped.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
}

app.whenReady().then(async () => {
  const [settings, savedState] = await Promise.all([readSettings(), readWindowState()])
  windowState = savedState
  trayEnabled = settings.trayEnabled === true
  closeToTray = settings.closeToTray === true
  messengerNotifications = settings.messengerNotifications === true
  startMinimized = settings.startMinimized === true && (trayEnabled || closeToTray)
  syncTray()
  createWindow()
  scheduleTheme()

  app.on('activate', () => {
    if (mainWindow) showMainWindow()
    else createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (windowStateTimer) { clearTimeout(windowStateTimer); windowStateTimer = null }
  captureWindowState()
  destroyTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})

// IPC Handlers for RSS
ipcMain.handle('feeds:get', async () => readFeeds())
ipcMain.handle('feeds:add', async (_: IpcMainInvokeEvent, input: string, type: SourceType = 'rss') => {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Enter a source URL or identifier')
  let feedUrl: string
  let sourceUrl: string
  let title: string
  let metadata: Record<string, string> = {}
  if (type === 'youtube') {
    const channel = await resolveYouTubeChannelAsync(input)
    feedUrl = channel.feedUrl
    sourceUrl = channel.channelUrl
    title = channel.channelId
    metadata = { channelId: channel.channelId }
  } else if (type === 'reddit') {
    const community = resolveRedditCommunity(input)
    feedUrl = community.feedUrl
    sourceUrl = community.communityUrl
    title = `r/${community.name}`
    metadata = { community: community.name }
  } else {
    const safeUrl = publicWebUrl(input.trim())
    if (!safeUrl) throw new Error('Enter a public HTTP(S) feed URL without credentials or private addresses')
    const parsed = new URL(safeUrl)
    feedUrl = safeUrl
    sourceUrl = feedUrl
    title = parsed.hostname
  }
  const feeds = await readFeeds()
  if (feeds.some(feed => feed.url === feedUrl)) throw new Error('This feed is already subscribed')
  const newFeed = {
    id: sourceId(type, feedUrl),
    type,
    url: feedUrl,
    sourceUrl,
    title,
    enabled: true,
    lastFetched: null,
    lastError: null as string | null,
    metadata,
    categoryIds: [],
  }
  let items: any[] = []
  if (type === 'reddit') {
    // Reddit commonly blocks RSS requests (404/429). Keep the subscription and
    // explain the limitation instead of surfacing a raw IPC exception.
    try { items = await fetchSource(newFeed, true) }
    catch (error) { newFeed.lastError = redditFeedError(error) }
  } else {
    items = await fetchSource(newFeed, true)
  }
  if (type === 'rss' && items[0]) newFeed.title = items[0].sourceName || title
  feeds.push(newFeed)
  await writeFeeds(feeds)
  return newFeed
})
ipcMain.handle('feeds:remove', async (_: IpcMainInvokeEvent, url: string) => {
  const feeds = await readFeeds()
  const filtered = feeds.filter(f => f.url !== url)
  await writeFeeds(filtered)
  return filtered
})
ipcMain.handle('feeds:toggle', async (_: IpcMainInvokeEvent, url: string) => {
  const feeds = await readFeeds()
  const feed = feeds.find(f => f.url === url)
  if (feed) feed.enabled = !feed.enabled
  await writeFeeds(feeds)
  return feeds
})
ipcMain.handle('feeds:refresh', async (_: IpcMainInvokeEvent, url?: string) => {
  if (url) {
    const feeds = await readFeeds()
    const feed = feeds.find(f => f.url === url || f.id === url)
    if (!feed) throw new Error('Source not found')
    clearSourceCache(feed.id)
    try {
      const articles = await fetchSource(feed, true)
      feed.lastFetched = new Date().toISOString()
      feed.lastError = null
      await writeFeeds(feeds)
      return articles
    } catch (error) {
      feed.lastError = feed.type === 'reddit'
        ? redditFeedError(error)
        : error instanceof Error ? error.message : 'Could not refresh this source'
      await writeFeeds(feeds)
      throw new Error(feed.lastError)
    }
  }
  clearSourceCache()
  return getAllArticles(true)
})
ipcMain.handle('feeds:update-title', async (_: IpcMainInvokeEvent, url: string, title: string) => {
  const feeds = await readFeeds()
  const feed = feeds.find(f => f.url === url)
  if (feed) feed.title = title
  await writeFeeds(feeds)
  return feeds
})

// IPC Handlers for Articles/Read State
ipcMain.handle('articles:read', async (_: IpcMainInvokeEvent, link: string) => {
  const source = readerSources.get(link)
  if (!source) throw new Error('This article is no longer in the feed. Return to Feed and refresh.')
  if (!readerCache.has(link)) {
    if (readerCache.size >= 20) readerCache.delete(readerCache.keys().next().value!)
    const pending = import('./reader.js').then(({ readArticle }) => readArticle(source))
    readerCache.set(link, pending)
    pending.catch(() => readerCache.delete(link))
  }
  return readerCache.get(link)
})
ipcMain.handle('articles:get', async () => getAllArticles())
ipcMain.handle('articles:mark-read', async (_: IpcMainInvokeEvent, key: string) => updateReadState([key], true))
ipcMain.handle('articles:mark-unread', async (_: IpcMainInvokeEvent, key: string) => updateReadState([key], false))
ipcMain.handle('articles:mark-all-read', async (_: IpcMainInvokeEvent, keys: string[]) => {
  if (!Array.isArray(keys) || keys.some(key => typeof key !== 'string')) throw new Error('Invalid content ids')
  return updateReadState(keys, true)
})

// IPC Handlers for Settings
ipcMain.handle('settings:get', async () => readSettings())
ipcMain.handle('settings:set', async (_: IpcMainInvokeEvent, key: string, value: any) => {
  if (!isAllowedSettingKey(key)) throw new Error('Unknown setting')
  const settings = await readSettings()
  let normalizedValue = value
  if (key === 'messengerWidth') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Messenger width must be a finite number')
    }
    normalizedValue = Math.max(320, Math.min(600, value))
  } else if (key === 'messengerVisible' && typeof value !== 'boolean') {
    throw new Error('Messenger visibility must be a boolean')
  } else if (['trayEnabled', 'closeToTray', 'startMinimized', 'messengerNotifications', 'onboardingComplete'].includes(key) && typeof value !== 'boolean') {
    throw new Error(`${key} must be a boolean`)
  } else if (key === 'feedFilterMode' && !['all', 'unread', 'saved'].includes(value)) {
    throw new Error('Invalid feed filter mode')
  } else if (key === 'feedSourceTypeFilter' && !['all', 'rss', 'youtube', 'reddit'].includes(value)) {
    throw new Error('Invalid source type filter')
  } else if (key === 'savedSort' && !['newest', 'oldest', 'title'].includes(value)) {
    throw new Error('Invalid saved sort order')
  } else if (['feedViewId', 'feedCategoryFilter', 'feedSourceFilter', 'feedDateFrom', 'feedDateTo'].includes(key)) {
    if (typeof value !== 'string' || value.length > 200) throw new Error(`${key} must be a short string`)
    if (key.startsWith('feedDate') && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date')
  }

  ;(settings as Record<string, any>)[key] = normalizedValue
  await writeSettings(settings)

  if (key === 'messengerWidth') setMessengerWidth(normalizedValue)
  if (key === 'messengerVisible') setMessengerVisible(normalizedValue)
  if (key === 'theme') scheduleTheme()
  if (key === 'trayEnabled') trayEnabled = normalizedValue
  if (key === 'closeToTray') closeToTray = normalizedValue
  if (key === 'startMinimized') startMinimized = normalizedValue
  if (key === 'messengerNotifications') messengerNotifications = normalizedValue
  if (['trayEnabled', 'closeToTray'].includes(key)) syncTray()
  if (key === 'messengerNotifications' && !normalizedValue) setMessengerUnread(messengerUnread)
  publishDesktopState()
  return settings
})

// IPC Handlers for Messenger
ipcMain.handle('messenger:status', () => ({ loaded: messengerLoaded }))
ipcMain.handle('messenger:set-visible', async (_: IpcMainInvokeEvent, visible: boolean) => {
  setMessengerVisible(visible)
  return isMessengerVisible
})
ipcMain.handle('messenger:set-width', async (_: IpcMainInvokeEvent, width: number) => {
  setMessengerWidth(width)
  return width
})
ipcMain.handle('messenger:reload', async () => {
  loadMessenger()
})
ipcMain.handle('messenger:back-to-messenger', async () => {
  loadMessenger()
})
ipcMain.handle('messenger:go-back', async () => {
  messengerView?.webContents.goBack()
})
ipcMain.handle('messenger:go-forward', async () => {
  messengerView?.webContents.goForward()
})
ipcMain.handle('messenger:get-location', () => currentMessengerLocation())
ipcMain.handle('messenger:navigate', async (_: IpcMainInvokeEvent, rawUrl: string) => {
  const decision = classifyMessengerNavigation(rawUrl)
  if (decision.kind !== 'allow' || !isMessengerContentUrl(decision.url)) {
    throw new Error('Only Messenger conversation pages can be opened in Mado')
  }
  if (!messengerView || messengerView.webContents.isDestroyed()) {
    throw new Error('Messenger is not available yet')
  }
  await messengerView.webContents.loadURL(decision.url)
  publishMessengerLocation()
})

ipcMain.handle('messenger-tabs:get', async () => readConversationTabs())
ipcMain.handle('messenger-tabs:save', async (_: IpcMainInvokeEvent, tabs: unknown) => writeConversationTabs(tabs))

ipcMain.handle('messenger:mark-seen', () => {
  setMessengerUnread(0)
})
ipcMain.handle('desktop:get-state', () => ({
  trayActive: isTrayActive(),
  closeToTray,
  trayEnabled,
  messengerNotifications,
  messengerUnread: messengerUnread > 0,
  windowState: windowState ? { ...windowState } : null,
}))

ipcMain.handle('categories:get', async () => readCategories())
ipcMain.handle('categories:create', async (_: IpcMainInvokeEvent, name: string) => createCategory(name))
ipcMain.handle('categories:rename', async (_: IpcMainInvokeEvent, id: string, name: string) => renameCategory(id, name))
ipcMain.handle('categories:delete', async (_: IpcMainInvokeEvent, id: string) => deleteCategory(id))
ipcMain.handle('categories:assign', async (_: IpcMainInvokeEvent, url: string, ids: string[]) => assignCategories(url, ids))

ipcMain.handle('saved:get', async () => readSaved())
ipcMain.handle('saved:save', async (_: IpcMainInvokeEvent, item: unknown) => saveContent(item))
ipcMain.handle('saved:unsave', async (_: IpcMainInvokeEvent, key: string) => unsaveContent(key))

ipcMain.handle('views:get', async () => readViews())
ipcMain.handle('views:create', async (_: IpcMainInvokeEvent, value: unknown) => createView(value))
ipcMain.handle('views:update', async (_: IpcMainInvokeEvent, id: string, value: unknown) => updateView(id, value))
ipcMain.handle('views:delete', async (_: IpcMainInvokeEvent, id: string) => deleteView(id))

ipcMain.handle('sources:discover', async (_: IpcMainInvokeEvent, input: string) => discoverSources(input))

ipcMain.handle('opml:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'OPML files', extensions: ['opml', 'xml'] }],
  })
  if (canceled || !filePaths.length) return null
  const xml = await readFile(filePaths[0], 'utf8')
  const feeds = await readFeeds()
  const result = parseOpml(xml, feeds.map(feed => feed.url))
  const categories = await readCategories()
  const byName = new Map(categories.map(category => [category.name.toLowerCase(), category.id]))
  const categoryStoreUpdates = [...new Set(result.entries.flatMap(entry => entry.categories))]
  for (const name of categoryStoreUpdates) {
    if (!byName.has(name.toLowerCase())) {
      const created = await createCategory(name)
      if (created.category) byName.set(created.category.name.toLowerCase(), created.category.id)
    }
  }
  const added = result.entries.map(entry => ({
    id: sourceId('rss', entry.url),
    type: 'rss' as SourceType,
    url: entry.url,
    sourceUrl: entry.url,
    title: entry.title,
    enabled: true,
    lastFetched: null,
    lastError: null,
    metadata: {},
    categoryIds: entry.categories.map(name => byName.get(name.toLowerCase())).filter((id): id is string => !!id),
  }))
  if (added.length) await writeFeeds([...feeds, ...added])
  return { imported: added.length, duplicates: result.duplicates.length, invalid: result.invalid.length, reasons: result.invalid.map(entry => entry.reason) }
})

ipcMain.handle('opml:export', async () => {
  const feeds = (await readFeeds()).filter(feed => feed.type === 'rss')
  const names = categoryNameMap(await readCategories())
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'mado-subscriptions.opml',
    filters: [{ name: 'OPML files', extensions: ['opml'] }],
  })
  if (canceled || !filePath) return null
  await writeFile(filePath, buildOpml(feeds.map(feed => ({
    url: feed.url,
    title: feed.title,
    categories: (feed.categoryIds || []).map(id => names[id]).filter(Boolean),
  }))), 'utf8')
  return filePath
})

ipcMain.handle('config:export', async () => {
  const [feeds, categories, views, settings] = await Promise.all([readFeeds(), readCategories(), readViews(), readSettings()])
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'mado-config.json',
    filters: [{ name: 'JSON files', extensions: ['json'] }],
  })
  if (canceled || !filePath) return null
  const payload = {
    format: 'mado-config',
    version: 1,
    exportedAt: new Date().toISOString(),
    feeds, categories, views, settings,
  }
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return filePath
})

ipcMain.handle('updates:check', async () => checkForUpdates(app.getVersion()))
ipcMain.handle('updates:open', async (_: IpcMainInvokeEvent, url: string) => {
  const configured = configuredRelease()
  if (!configured || typeof url !== 'string' || url !== configured.releaseUrl) {
    throw new Error('No official release source is configured')
  }
  await openExternalUrl(url)
})

ipcMain.handle('app:reset', async () => {
  clearSourceCache()
  await resetApplicationData()
  readerSources.clear()
  readerCache.clear()
})

// External links
ipcMain.handle('shell:open-external', async (_: IpcMainInvokeEvent, url: string) => {
  await openExternalUrl(url)
})
