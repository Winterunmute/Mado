import { fetchFeed } from '../rss.js'
import { contentId, type ContentItem, type SourceSubscription } from './model.js'

export async function fetchRssSource(source: SourceSubscription): Promise<ContentItem[]> {
  const articles = await fetchFeed(source.url)
  return articles.map((article: any) => ({
    id: contentId(source, article.link),
    sourceId: source.id,
    sourceType: 'rss',
    sourceName: article.feedTitle || source.title,
    title: article.title,
    link: article.link,
    pubDate: article.pubDate,
    description: article.description,
    contentHtml: article.contentHtml || '',
    thumbnail: article.thumbnail || null,
    contentType: 'article',
    author: null,
    metadata: {},
    feedUrl: source.url,
    feedTitle: article.feedTitle || source.title,
    isRead: false,
  }))
}
