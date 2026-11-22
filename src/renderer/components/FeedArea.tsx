import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { 
  RefreshCw, 
  Filter, 
  Eye, 
  EyeOff, 
  Loader2, 
  ChevronDown,
  Search,
  X,
  SlidersHorizontal,
  Bookmark,
  Layers
} from 'lucide-react'
import { classNames } from '../lib/utils'
import { selectArticlesWithOptions, hasActiveFilters } from '../lib/article-filter'
import type { Article, ContentType, SourceType } from '../types'
import { useArticles, useSettings, useFeedActions, useStore } from '../hooks/useStore'
import ArticleCard from './ArticleCard'
import ArticleReader from './ArticleReader'
import './FeedArea.css'

export default function FeedArea() {
  const { articles, loading, error, refetch, setFilter, filter, setSearchQuery, searchQuery } = useArticles()
  const { feedDensity, setFeedDensity } = useSettings()
  const { feeds } = useFeedActions()
  const store = useStore()
  const { markAllRead, markRead, categories, views, settings, contentTypeFilter } = store
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const sourceTypeFilter = (settings.feedSourceTypeFilter || 'all') as SourceType | 'all'
  const sourceFilter = settings.feedSourceFilter || 'all'
  const categoryFilter = settings.feedCategoryFilter || 'all'
  const viewId = settings.feedViewId || 'all'
  const activeView = views.find(view => view.id === viewId) || null
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

  const filterOptions = {
    mode: filter,
    query: searchQuery,
    categoryId: categoryFilter,
    sourceType: sourceTypeFilter,
    sourceId: sourceFilter,
    contentType: contentTypeFilter,
    dateFrom: settings.feedDateFrom,
    dateTo: settings.feedDateTo,
    view: activeView,
  }
  const filteredArticles = selectArticlesWithOptions(articles, filterOptions)
  const filtersActive = hasActiveFilters(filterOptions)

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
              aria-label="Select feed view"
              value={viewId}
              onChange={e => store.setFeedViewId(e.target.value)}
              className="source-filter-select"
            >
              <option value="all">All feed</option>
              <option value="saved">Saved</option>
              {views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
            <button
              className={classNames('advanced-btn', showAdvanced && 'active', filtersActive && 'filtered')}
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              aria-label="Advanced filters"
              title="Advanced filters"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
            </button>
            <select
              aria-label="Filter by source type"
              value={sourceTypeFilter}
              onChange={e => { store.setSourceTypeFilter(e.target.value as SourceType | 'all'); store.setSourceFilter('all') }}
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
              onChange={e => store.setSourceFilter(e.target.value)}
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
              className={classNames('saved-filter-btn', filter === 'saved' && 'active')}
              onClick={() => setFilter(filter === 'saved' ? 'all' : 'saved')}
              aria-label="Show saved items"
              aria-pressed={filter === 'saved'}
            >
              <Bookmark size={16} aria-hidden="true" />
              <span>Saved</span>
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

      {showAdvanced && !selectedArticle && (
        <div className="advanced-filters" role="group" aria-label="Advanced filters">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={e => store.setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select
            aria-label="Filter by content type"
            value={contentTypeFilter}
            onChange={e => store.setContentTypeFilter(e.target.value as ContentType | 'all')}
          >
            <option value="all">All content</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="post">Posts</option>
            <option value="image">Images</option>
            <option value="link">Links</option>
          </select>
          <label>From <input type="date" aria-label="Published from" value={settings.feedDateFrom} onChange={e => store.setDateRange(e.target.value, settings.feedDateTo)} /></label>
          <label>To <input type="date" aria-label="Published to" value={settings.feedDateTo} onChange={e => store.setDateRange(settings.feedDateFrom, e.target.value)} /></label>
          <button className="clear-filters" onClick={store.clearFilters} disabled={!filtersActive}>Clear Filters</button>
        </div>
      )}
      {filtersActive && !selectedArticle && (
        <div className="active-filters" aria-label="Active filters">
          {viewId === 'saved' && <span className="filter-chip"><Bookmark size={11} /> Saved</span>}
          {activeView && <span className="filter-chip"><Layers size={11} /> {activeView.name}</span>}
          {filter !== 'all' && <span className="filter-chip">{filter === 'unread' ? 'Unread' : 'Saved'}</span>}
          {categoryFilter !== 'all' && <span className="filter-chip">{categories.find(c => c.id === categoryFilter)?.name || 'Category'}</span>}
          {sourceTypeFilter !== 'all' && <span className="filter-chip">{sourceTypeFilter}</span>}
          {sourceFilter !== 'all' && <span className="filter-chip">{feeds.find(f => (f.id || f.url) === sourceFilter)?.title || 'Source'}</span>}
          {contentTypeFilter !== 'all' && <span className="filter-chip">{contentTypeFilter}</span>}
          {settings.feedDateFrom && <span className="filter-chip">From {settings.feedDateFrom}</span>}
          {settings.feedDateTo && <span className="filter-chip">To {settings.feedDateTo}</span>}
          {searchQuery && <span className="filter-chip">“{searchQuery}”</span>}
          <button onClick={store.clearFilters}>Clear all</button>
        </div>
      )}

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
            <h2>No content found</h2>
            <p>{filtersActive ? 'No items match these filters. Try clearing them or choosing another view.' : searchQuery ? 'Try a different search term' : filter === 'unread' && feeds.length ? 'You’re caught up. Switch to All to revisit read articles.' : 'Enable or add sources to get started'}</p>
            {filtersActive && <button className="add-first-feed" onClick={store.clearFilters}>Clear Filters</button>}
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
