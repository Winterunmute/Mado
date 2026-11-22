import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { 
  RefreshCw, 
  Filter, 
  Eye, 
  EyeOff, 
  Loader2, 
  ChevronDown,
  Search,
  X
} from 'lucide-react'
import { classNames } from '../lib/utils'
import { selectArticles } from '../lib/article-filter'
import type { Article, SourceType } from '../types'
import { useArticles, useSettings, useFeedActions, useStore } from '../hooks/useStore'
import ArticleCard from './ArticleCard'
import ArticleReader from './ArticleReader'
import './FeedArea.css'

export default function FeedArea() {
  const { articles, loading, error, refetch, setFilter, filter, setSearchQuery, searchQuery } = useArticles()
  const { feedDensity, setFeedDensity } = useSettings()
  const { addFeed, removeFeed, toggleFeed, refreshFeeds, feeds } = useFeedActions()
  const { markAllRead, markRead } = useStore()
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceType | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const feedRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollPosition = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!selectedArticle && feedRef.current) {
      feedRef.current.scrollTop = scrollPosition.current
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
      else feedRef.current.focus({ preventScroll: true })
    }
  }, [selectedArticle])
  const openArticle = (article: Article) => {
    scrollPosition.current = feedRef.current?.scrollTop || 0
    returnFocus.current = document.activeElement as HTMLElement
    setShowDensityMenu(false)
    setSelectedArticle(article)
    if (!article.isRead) void markRead(article.id || article.link, true)
  }
  const openSources = () => window.dispatchEvent(new CustomEvent('open-feed-manager'))
  const [showDensityMenu, setShowDensityMenu] = useState(false)

  const filteredArticles = selectArticles(articles, filter, searchQuery, sourceTypeFilter, sourceFilter)

  const handleRefresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  useEffect(() => {
    const refresh = () => { void handleRefresh() }
    const focusSearch = () => {
      document.querySelector<HTMLButtonElement>('[aria-label="Home"]')?.click()
      window.setTimeout(() => { searchRef.current?.focus(); searchRef.current?.select() }, 0)
    }
    const escape = () => setSelectedArticle(current => current ? null : current)
    window.addEventListener('shortcut:refresh-feed', refresh)
    window.addEventListener('shortcut:focus-search', focusSearch)
    window.addEventListener('shortcut:back-from-reader', escape)
    return () => {
      window.removeEventListener('shortcut:refresh-feed', refresh)
      window.removeEventListener('shortcut:focus-search', focusSearch)
      window.removeEventListener('shortcut:back-from-reader', escape)
    }
  }, [handleRefresh])

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead(filteredArticles.map(a => a.id || a.link))
  }, [markAllRead, filteredArticles])

  const densityOptions = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'spacious', label: 'Spacious' },
  ] as const

  return (
    <main className="feed-area" role="main">
      <header className="feed-header" hidden={!!selectedArticle}>
        <div className="feed-header-left">
          <h1 className="feed-title">Feed</h1>
          <span className="article-count">{filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="feed-header-right">
          <div className="search-box">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search articles…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search articles"
              ref={searchRef}
            />
            {searchQuery && (
              <button 
                className="search-clear" 
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="source-filters">
            <select
              aria-label="Filter by source type"
              value={sourceTypeFilter}
              onChange={e => { setSourceTypeFilter(e.target.value as SourceType | 'all'); setSourceFilter('all') }}
              className="source-filter-select"
            >
              <option value="all">All types</option>
              <option value="rss">Articles</option>
              <option value="youtube">Videos</option>
              <option value="reddit">Reddit</option>
            </select>
            <select
              aria-label="Filter by source"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="source-filter-select"
            >
              <option value="all">All sources</option>
              {feeds.filter(feed => sourceTypeFilter === 'all' || (feed.type || 'rss') === sourceTypeFilter)
                .map(feed => <option key={feed.id || feed.url} value={feed.id || feed.url}>{feed.title}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <button
              className={classNames('filter-btn', filter === 'unread' && 'active')}
              onClick={() => setFilter(filter === 'unread' ? 'all' : 'unread')}
              aria-pressed={filter === 'unread'}
            >
              <Filter size={16} aria-hidden="true" />
              <span>{filter === 'unread' ? 'Unread' : 'All'}</span>
            </button>
            <button
              className="density-btn"
              onClick={() => setShowDensityMenu(!showDensityMenu)}
              aria-expanded={showDensityMenu}
              aria-haspopup="menu"
            >
              <Eye size={16} aria-hidden="true" />
              <span>{feedDensity}</span>
              <ChevronDown size={12} />
            </button>
            {showDensityMenu && (
              <div className="density-menu" role="menu">
                {densityOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={classNames('density-option', feedDensity === opt.value && 'active')}
                    onClick={() => { setFeedDensity(opt.value); setShowDensityMenu(false) }}
                    role="menuitem"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <button
              className="refresh-btn"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh feeds"
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <button
              className="manage-btn"
              onClick={openSources}
              aria-label="Manage sources"
            >
              <span>Manage</span>
            </button>
            <button
              className="mark-read-btn"
              onClick={handleMarkAllRead}
              disabled={filteredArticles.every(a => a.isRead)}
              aria-label="Mark all as read"
            >
              <EyeOff size={16} aria-hidden="true" />
              <span>Mark read</span>
            </button>
          </div>
        </div>
      </header>

      {error && !selectedArticle && (
        <div className="feed-error" role="alert">
          <span>{error}</span>
          <button onClick={handleRefresh}>Retry</button>
        </div>
      )}

      <div className="feed-container" role="feed" aria-label="Articles" ref={feedRef} hidden={!!selectedArticle} tabIndex={-1}>
        {loading && filteredArticles.length === 0 ? (
          <div className="feed-loading">
            <Loader2 size={32} className="spinning" aria-hidden="true" />
            <p>Loading articles…</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="feed-empty">
            <div className="empty-icon">
              <Filter size={48} aria-hidden="true" />
            </div>
            <h2>No articles found</h2>
            <p>{searchQuery ? 'Try a different search term' : filter === 'unread' && feeds.length ? 'You’re caught up. Switch to All to revisit read articles.' : 'Enable or add RSS sources to get started'}</p>
            {!searchQuery && feeds.length === 0 && (
              <button className="add-first-feed" onClick={openSources}>
                Add your first feed
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredArticles.map((article) => (
              <ArticleCard
                key={article.id || `${article.feedUrl}:${article.link}`}
                article={article}
                density={feedDensity}
                onOpen={openArticle}
              />
            ))}
            <div className="feed-end">
              <span>You're all caught up</span>
            </div>
          </>
        )}
      </div>

      {selectedArticle && <ArticleReader article={selectedArticle} onBack={() => setSelectedArticle(null)} />}

      {showDensityMenu && (
        <div className="overlay" onClick={() => setShowDensityMenu(false)} />
      )}
    </main>
  )
}
