import type { Article, FilterMode, SourceType } from '../types'

// The toolbar and Settings share one persisted preference.
export function filterFromPreference(showReadArticles: boolean): FilterMode {
  return showReadArticles ? 'all' : 'unread'
}

export function selectArticles(
  articles: Article[],
  filter: FilterMode,
  query: string,
  sourceType: SourceType | 'all' = 'all',
  sourceId: string = 'all',
): Article[] {
  const search = query.trim().toLocaleLowerCase()
  return articles.filter(article =>
    (filter === 'all' || !article.isRead) &&
    (sourceType === 'all' || article.sourceType === sourceType) &&
    (sourceId === 'all' || article.sourceId === sourceId || article.feedUrl === sourceId) &&
    (!search || [article.title, article.description, article.feedTitle, article.author || '']
      .some(value => value.toLocaleLowerCase().includes(search))))
}
