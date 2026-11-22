import Store from 'electron-store'
import { join } from 'path'
import { app } from 'electron'
import { sanitizeConversationTabs, type ConversationTab } from './conversation-tabs.js'
import { sanitizeWindowState, DEFAULT_WINDOW_STATE, type WindowState } from './window-state.js'
import { normalizeSources, sourceId, type SourceSubscription, type SourceType } from './sources/model.js'
import { categoryId, normalizeCategories, sanitizeCategoryName, type Category } from './organize/categories.js'
import { normalizeSavedItem, normalizeSavedMap, savedKey, toSavedItem, type SavedItem } from './organize/saved.js'
import { normalizeViews, sanitizeViewName, viewId, type CustomFeedView } from './organize/views.js'

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
  feedViewId: 'all',
  feedFilterMode: 'all',
  feedCategoryFilter: 'all',
  feedSourceTypeFilter: 'all',
  feedSourceFilter: 'all',
  feedDateFrom: '',
  feedDateTo: '',
  savedSort: 'newest',
  onboardingComplete: false,
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

const categoryStore = new Store<Record<string, any>>({
  name: 'categories',
  defaults: { version: 1, categories: [] },
  cwd: join(app.getPath('userData'), 'mado'),
})

const savedStore = new Store<Record<string, any>>({
  name: 'saved',
  defaults: { version: 1, items: {} },
  cwd: join(app.getPath('userData'), 'mado'),
})

const viewStore = new Store<Record<string, any>>({
  name: 'feed-views',
  defaults: { version: 1, views: [] },
  cwd: join(app.getPath('userData'), 'mado'),
})

export async function readFeeds(): Promise<Feed[]> {
  return normalizeSources(feedStore.get('feeds'), defaultFeeds)
}

export async function writeFeeds(feeds: Feed[]): Promise<void> {
  feedStore.set('feeds', { version: 3, feeds })
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
  'feedViewId', 'feedFilterMode', 'feedCategoryFilter', 'feedSourceTypeFilter',
  'feedSourceFilter', 'feedDateFrom', 'feedDateTo', 'savedSort', 'onboardingComplete',
] as const

export function isAllowedSettingKey(key: string): boolean {
  return (ALLOWED_SETTING_KEYS as readonly string[]).includes(key)
}

// Resets local app data only. The persist:messenger partition is untouched.
export async function resetApplicationData(): Promise<void> {
  feedStore.set('feeds', { version: 3, feeds: defaultFeeds })
  readStateStore.set('state', {})
  settingsStore.set('settings', defaultSettings)
  conversationTabStore.set('tabs', [])
  windowStateStore.set('state', DEFAULT_WINDOW_STATE)
  categoryStore.set('categories', { version: 1, categories: [] })
  savedStore.set('items', { version: 1, items: {} })
  viewStore.set('views', { version: 1, views: [] })
}

export async function readCategories(): Promise<Category[]> {
  return normalizeCategories(categoryStore.get('categories'))
}

function writeCategories(categories: Category[]): Category[] {
  const cleaned = normalizeCategories(categories)
  categoryStore.set('categories', { version: 1, categories: cleaned })
  return cleaned
}

export async function createCategory(name: unknown): Promise<{ categories: Category[]; category: Category | null }> {
  const clean = sanitizeCategoryName(name)
  if (!clean) return { categories: await readCategories(), category: null }
  const categories = await readCategories()
  const existing = categories.find(category => category.name.toLowerCase() === clean.toLowerCase())
  if (existing) return { categories, category: existing }
  const category = { id: categoryId(clean), name: clean }
  return { categories: writeCategories([...categories, category]), category }
}

export async function renameCategory(id: string, name: unknown): Promise<Category[]> {
  const clean = sanitizeCategoryName(name)
  const categories = await readCategories()
  if (!clean) return categories
  return writeCategories(categories.map(category => category.id === id ? { ...category, name: clean } : category))
}

export async function deleteCategory(id: string): Promise<{ categories: Category[]; feeds: Feed[] }> {
  const categories = writeCategories((await readCategories()).filter(category => category.id !== id))
  const feeds = (await readFeeds()).map(feed => ({ ...feed, categoryIds: feed.categoryIds.filter(value => value !== id) }))
  await writeFeeds(feeds)
  return { categories, feeds }
}

export async function assignCategories(url: string, ids: unknown): Promise<Feed[]> {
  const valid = new Set((await readCategories()).map(category => category.id))
  const categoryIds = Array.isArray(ids)
    ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && valid.has(id)))]
    : []
  const feeds = (await readFeeds()).map(feed => feed.url === url || feed.id === url ? { ...feed, categoryIds } : feed)
  await writeFeeds(feeds)
  return feeds
}

export async function readSaved(): Promise<Record<string, SavedItem>> {
  return normalizeSavedMap(savedStore.get('items'))
}

export async function saveContent(value: unknown): Promise<SavedItem | null> {
  const item = toSavedItem(value as any)
  if (!item) return null
  const saved = readSavedRaw()
  saved[savedKey(item)] = item
  savedStore.set('items', { version: 1, items: saved })
  return item
}

function readSavedRaw(): Record<string, SavedItem> {
  const raw = savedStore.get('items') as any
  return raw?.items && typeof raw.items === 'object' ? normalizeSavedMap(raw) : {}
}

export async function unsaveContent(key: string): Promise<Record<string, SavedItem>> {
  const saved = readSavedRaw()
  delete saved[key]
  savedStore.set('items', { version: 1, items: saved })
  return saved
}

export async function readViews(): Promise<CustomFeedView[]> {
  return normalizeViews(viewStore.get('views'))
}

function writeViews(views: CustomFeedView[]): CustomFeedView[] {
  const cleaned = normalizeViews(views)
  viewStore.set('views', { version: 1, views: cleaned })
  return cleaned
}

export async function createView(value: unknown): Promise<CustomFeedView[]> {
  const name = sanitizeViewName(value && typeof value === 'object' ? (value as any).name : value)
  const candidate = name ? normalizeViews([{ ...(value as any), name }])[0] : null
  const views = await readViews()
  if (!candidate) return views
  const base = candidate.id
  const id = views.some(view => view.id === base) ? `${base}-${Date.now().toString(36)}` : base
  return writeViews([...views, { ...candidate, id }])
}

export async function updateView(id: string, value: unknown): Promise<CustomFeedView[]> {
  const views = await readViews()
  const source = views.find(view => view.id === id)
  if (!source) return views
  const candidate = normalizeViews([{ ...source, ...(value as any), id }])[0]
  return writeViews(views.map(view => view.id === id ? candidate : view))
}

export async function deleteView(id: string): Promise<CustomFeedView[]> {
  return writeViews((await readViews()).filter(view => view.id !== id))
}
