import Store from 'electron-store'
import { join } from 'path'
import { app } from 'electron'
import { sanitizeConversationTabs, type ConversationTab } from './conversation-tabs.js'
import { sanitizeWindowState, DEFAULT_WINDOW_STATE, type WindowState } from './window-state.js'
import { normalizeSources, sourceId, type SourceSubscription, type SourceType } from './sources/model.js'

type Feed = SourceSubscription

interface ReadState {
  [link: string]: boolean
}

interface Settings {
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

const legacyDefaultFeeds = [
  { url: 'https://www.theverge.com/rss/index.xml', title: 'The Verge' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', title: 'Ars Technica' },
  { url: 'https://kotaku.com/rss', title: 'Kotaku' },
  { url: 'https://www.pcgamer.com/rss/', title: 'PC Gamer' },
  { url: 'https://feeds.feedburner.com/TechCrunch/', title: 'TechCrunch' },
  { url: 'https://www.wired.com/feed/rss', title: 'WIRED' },
]

const defaultFeeds: Feed[] = normalizeSources(legacyDefaultFeeds, []).map(feed => ({ ...feed, type: 'rss' as SourceType }))

const defaultSettings: Settings = {
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
}

const feedStore = new Store<Record<string, any>>({
  name: 'feeds',
  defaults: { feeds: defaultFeeds },
  cwd: join(app.getPath('userData'), 'mado'),
})

const readStateStore = new Store<Record<string, any>>({
  name: 'read-state',
  defaults: { state: {} },
  cwd: join(app.getPath('userData'), 'mado'),
})

const settingsStore = new Store<Record<string, any>>({
  name: 'settings',
  defaults: { settings: defaultSettings },
  cwd: join(app.getPath('userData'), 'mado'),
})

const conversationTabStore = new Store<Record<string, any>>({
  name: 'messenger-tabs',
  defaults: { tabs: [] },
  cwd: join(app.getPath('userData'), 'mado'),
})

const windowStateStore = new Store<Record<string, any>>({
  name: 'window-state',
  defaults: { state: DEFAULT_WINDOW_STATE },
  cwd: join(app.getPath('userData'), 'mado'),
})

export async function readFeeds(): Promise<Feed[]> {
  return normalizeSources(feedStore.get('feeds'), defaultFeeds)
}

export async function writeFeeds(feeds: Feed[]): Promise<void> {
  feedStore.set('feeds', { version: 2, feeds })
}

export async function readReadState(): Promise<ReadState> {
  return (readStateStore.get('state') as ReadState) || {}
}

export async function writeReadState(state: ReadState): Promise<void> {
  readStateStore.set('state', state)
}

export async function readSettings(): Promise<Settings> {
  return { ...defaultSettings, ...settingsStore.get('settings') as Settings }
}

export function updateReadState(links: string[], read: boolean): ReadState {
  const state = (readStateStore.get('state') as ReadState) || {}
  for (const link of links) {
    if (read) state[link] = true
    else delete state[link]
  }
  readStateStore.set('state', state)
  return state
}

export async function writeSettings(settings: Settings): Promise<void> {
  settingsStore.set('settings', settings)
}

export async function readConversationTabs(): Promise<ConversationTab[]> {
  return sanitizeConversationTabs(conversationTabStore.get('tabs'))
}

export async function writeConversationTabs(tabs: unknown): Promise<ConversationTab[]> {
  const cleaned = sanitizeConversationTabs(tabs)
  conversationTabStore.set('tabs', cleaned)
  return cleaned
}

export async function readWindowState(): Promise<WindowState> {
  return sanitizeWindowState(windowStateStore.get('state'))
}

export async function writeWindowState(state: WindowState): Promise<WindowState> {
  const cleaned = sanitizeWindowState(state)
  windowStateStore.set('state', cleaned)
  return cleaned
}

export const ALLOWED_SETTING_KEYS = [
  'theme', 'feedDensity', 'messengerWidth', 'messengerVisible',
  'autoRefreshInterval', 'showReadArticles', 'trayEnabled',
  'closeToTray', 'startMinimized', 'messengerNotifications',
] as const

export function isAllowedSettingKey(key: string): boolean {
  return (ALLOWED_SETTING_KEYS as readonly string[]).includes(key)
}

// Resets local app data only. The persist:messenger partition is untouched.
export async function resetApplicationData(): Promise<void> {
  feedStore.set('feeds', { version: 2, feeds: defaultFeeds })
  readStateStore.set('state', {})
  settingsStore.set('settings', defaultSettings)
  conversationTabStore.set('tabs', [])
  windowStateStore.set('state', DEFAULT_WINDOW_STATE)
}
