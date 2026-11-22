import type { Article, ContentType, CustomFeedView, FilterMode, SourceType } from '../types'

export interface FeedFilterOptions {
  mode: FilterMode
  query: string
  categoryId?: string
  sourceType?: SourceType | 'all'
  sourceId?: string
  contentType?: ContentType | 'all'
  dateFrom?: string
  dateTo?: string
  view?: CustomFeedView | null
}

export function filterFromPreference(preference: boolean | { showReadArticles: boolean; feedFilterMode?: FilterMode }): FilterMode {
  const settings = typeof preference === 'boolean' ? { showReadArticles: preference } : preference
  if (settings.feedFilterMode === 'all' || settings.feedFilterMode === 'unread' || settings.feedFilterMode === 'saved') {
    return settings.feedFilterMode
  }
  return settings.showReadArticles ? 'all' : 'unread'
}

function matchesView(article: Article, view: CustomFeedView | null | undefined): boolean {
  if (!view) return true
  const categoryMatch = !view.categoryIds.length || view.categoryIds.some(id => article.categoryIds?.includes(id))
  const sourceMatch = !view.sourceIds.length || view.sourceIds.includes(article.sourceId)
  const typeMatch = view.typeFilter === 'all' || article.sourceType === view.typeFilter
  const contentTypeMatch = !view.contentTypes.length || view.contentTypes.includes(article.contentType)
  return categoryMatch && sourceMatch && typeMatch && contentTypeMatch
}

export function selectArticlesWithOptions(articles: Article[], options: FeedFilterOptions): Article[] {
  const search = options.query.trim().toLocaleLowerCase()
  const from = options.dateFrom ? new Date(`${options.dateFrom}T00:00:00`).getTime() : null
  const to = options.dateTo ? new Date(`${options.dateTo}T23:59:59`).getTime() : null
  return articles.filter(article => {
    if (options.mode === 'unread' && article.isRead) return false
    if (options.mode === 'saved' && !article.saved) return false
    if (options.categoryId && options.categoryId !== 'all' && !article.categoryIds?.includes(options.categoryId)) return false
    if (options.sourceType && options.sourceType !== 'all' && article.sourceType !== options.sourceType) return false
    if (options.sourceId && options.sourceId !== 'all' && article.sourceId !== options.sourceId && article.feedUrl !== options.sourceId) return false
    if (options.contentType && options.contentType !== 'all' && article.contentType !== options.contentType) return false
    if (!matchesView(article, options.view)) return false
    const time = new Date(article.pubDate).getTime()
    if (from !== null && Number.isFinite(from) && time < from) return false
    if (to !== null && Number.isFinite(to) && time > to) return false
    if (search && ![article.title, article.description, article.feedTitle, article.author || '']
      .some(value => value.toLocaleLowerCase().includes(search))) return false
    return true
  })
}

export function hasActiveFilters(options: FeedFilterOptions): boolean {
  const query = options.query || ''
  const categoryId = options.categoryId || 'all'
  const sourceType = options.sourceType || 'all'
  const sourceId = options.sourceId || 'all'
  const contentType = options.contentType || 'all'
  return Boolean(
    query.trim() || categoryId !== 'all' || sourceType !== 'all' ||
    sourceId !== 'all' || contentType !== 'all' || options.dateFrom || options.dateTo ||
    options.view || options.mode !== 'all',
  )
}

// V0.4–V0.6 callers keep working; V0.7 uses selectArticlesWithOptions.
export function selectArticles(
  articles: Article[],
  filter: FilterMode,
  query: string,
  sourceType: SourceType | 'all' = 'all',
  sourceId = 'all',
): Article[] {
  return selectArticlesWithOptions(articles, { mode: filter, query, sourceType, sourceId })
}
