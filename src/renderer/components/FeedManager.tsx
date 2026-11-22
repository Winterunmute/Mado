import React, { useState } from 'react'
import { Plus, Trash2, Loader2, AlertCircle, Link as LinkIcon, Rss, Youtube, MessageCircle, Tag, Download, Upload, Search, FolderPlus, Sparkles } from 'lucide-react'
import { useFeeds, useOrganize } from '../hooks/useStore'
import { api } from '../lib/api'
import type { SourceType, ContentType, DiscoveredSource } from '../types'
import { classNames, getDomain } from '../lib/utils'
import './FeedManager.css'

export default function FeedManager() {
  const { feeds, loading, error, addFeed, removeFeed, toggleFeed, refreshFeeds } = useFeeds()
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('rss')
  const [validating, setValidating] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [success, setSuccess] = useState<string | null>(null)
  const organize = useOrganize()
  const [newCategory, setNewCategory] = useState('')
  const [newViewName, setNewViewName] = useState('')
  const [discovered, setDiscovered] = useState<DiscoveredSource[]>([])
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [viewSourceIds, setViewSourceIds] = useState<string[]>([])
  const [viewCategoryIds, setViewCategoryIds] = useState<string[]>([])
  const [viewContentType, setViewContentType] = useState<ContentType | 'all'>('all')

  const sourceOptions: { type: SourceType; label: string; icon: typeof Rss; placeholder: string }[] = [
    { type: 'rss', label: 'RSS / Website', icon: Rss, placeholder: 'https://example.com/feed.xml' },
    { type: 'youtube', label: 'YouTube Channel', icon: Youtube, placeholder: 'UC… or youtube.com/channel/UC…' },
    { type: 'reddit', label: 'Reddit Community', icon: MessageCircle, placeholder: 'technology or reddit.com/r/technology' },
  ]
  const activeOption = sourceOptions.find(option => option.type === sourceType) || sourceOptions[0]

  const validateInput = (value: string): boolean => {
    if (!value.trim()) return false
    if (sourceType === 'youtube') return /^(UC[\w-]{20,24}|https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/UC[\w-]{20,24}|feeds\/videos\.xml\?channel_id=UC[\w-]{20,24}))$/i.test(value.trim())
    if (sourceType === 'reddit') return /^(?:\/?r\/)?[A-Za-z0-9_]{1,21}$|https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/[A-Za-z0-9_]{1,21}/i.test(value.trim())
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
  }

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateInput(newFeedUrl)) {
      setErrors(prev => ({ ...prev, add: 'Enter a valid source for this type' }))
      return
    }

    setValidating(newFeedUrl)
    setErrors(prev => ({ ...prev, add: null }))
    setSuccess(null)

    try {
      const result = await addFeed(newFeedUrl.trim(), sourceType)
      setSuccess(`Added "${result.title || getDomain(result.url)}"`)
      setNewFeedUrl('')
    } catch (err: any) {
      setErrors(prev => ({ ...prev, add: err.message || 'Failed to add feed' }))
    } finally {
      setValidating(null)
    }
  }

  const handleRemoveFeed = async (url: string) => {
    setValidating(url)
    setErrors(prev => ({ ...prev, [url]: null }))
    try {
      await removeFeed(url)
      setSuccess('Feed removed')
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [url]: err.message || 'Failed to remove feed' }))
    } finally { setValidating(null) }
  }

  const handleToggleFeed = async (url: string) => {
    setValidating(url)
    try {
      await toggleFeed(url)
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [url]: err.message || 'Failed to update source' }))
    } finally { setValidating(null) }
  }

  const handleRefreshFeed = async (url: string) => {
    setValidating(url)
    setErrors(prev => ({ ...prev, [url]: null }))
    try {
      await refreshFeeds(url)
      setSuccess('Feed refreshed')
    } catch (err: any) {
      setErrors(prev => ({ ...prev, [url]: err.message || 'Failed to refresh' }))
    } finally { setValidating(null) }
  }

  const handleRefreshAll = async () => {
    setRefreshingAll(true)
    setErrors(prev => ({ ...prev, all: null }))
    try {
      await refreshFeeds()
      setSuccess('Feeds refreshed')
    } catch (err: any) {
      setErrors(prev => ({ ...prev, all: err.message || 'Failed to refresh feeds' }))
    } finally {
      setRefreshingAll(false)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategory.trim()) return
    await organize.createCategory(newCategory.trim())
    setNewCategory('')
  }

  const handleCreateView = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newViewName.trim()) return
    await organize.createView({
      name: newViewName.trim(),
      categoryIds: viewCategoryIds,
      sourceIds: viewSourceIds,
      contentTypes: viewContentType === 'all' ? [] : [viewContentType],
      typeFilter: 'all',
    })
    setNewViewName('')
    setViewCategoryIds([])
    setViewSourceIds([])
    setViewContentType('all')
  }

  const handleDiscover = async () => {
    if (!newFeedUrl.trim()) return
    setDiscovering(true)
    setDiscoveryMessage(null)
    try {
      const result = await api.sources.discover(newFeedUrl.trim())
      setDiscovered(result.sources)
      setDiscoveryMessage(result.message)
    } catch (e: any) {
      setDiscovered([])
      setDiscoveryMessage(e.message || 'Could not inspect this URL')
    } finally { setDiscovering(false) }
  }

  const handleAddDiscovered = async (source: DiscoveredSource) => {
    try {
      await addFeed(source.url, source.kind)
      setDiscovered(prev => prev.filter(item => item.url !== source.url))
      setSuccess(`Added ${source.title}`)
    } catch (e: any) { setErrors(prev => ({ ...prev, add: e.message || 'Could not add source' })) }
  }

  const handleImport = async () => {
    try {
      const summary = await api.opml.import()
      if (summary) setSuccess(`Imported ${summary.imported}; skipped ${summary.duplicates} duplicates and ${summary.invalid} invalid entries`)
    } catch (e: any) { setErrors(prev => ({ ...prev, all: e.message || 'OPML import failed' })) }
  }

  const handleExport = async () => {
    try { const path = await api.opml.export(); if (path) setSuccess(`Exported to ${path}`) }
    catch (e: any) { setErrors(prev => ({ ...prev, all: e.message || 'OPML export failed' })) }
  }

  return (
    <main className="sources-view" aria-labelledby="feed-manager-title">
      <div className="feed-manager-panel">
        <header className="manager-header">
          <h2 id="feed-manager-title">Sources</h2>
          <span className="sources-subtitle">Your curated RSS, YouTube and Reddit sources</span>
        </header>

        {success && (
          <div className="toast success" role="status">
            {success}
          </div>
        )}

        <div className="manager-content">
          {error && <p className="error-message" role="alert">{error}</p>}
          <section className="add-feed-section">
            <h3>Add Source</h3>
            <div className="source-type-tabs" role="tablist" aria-label="Source type">
              {sourceOptions.map(option => {
                const Icon = option.icon
                return (
                  <button
                    key={option.type}
                    type="button"
                    role="tab"
                    aria-selected={sourceType === option.type}
                    className={classNames('source-type-tab', sourceType === option.type && 'active')}
                    onClick={() => { setSourceType(option.type); setErrors(prev => ({ ...prev, add: null })); setNewFeedUrl('') }}
                  >
                    <Icon size={14} aria-hidden="true" /> {option.label}
                  </button>
                )
              })}
            </div>
            <form onSubmit={handleAddFeed} className="add-feed-form">
              <div className="input-group">
                <label htmlFor="feed-url" className="sr-only">Feed URL or source identifier</label>
                <input
                  id="feed-url"
                  type="text"
                  inputMode="url"
                  placeholder={activeOption.placeholder}
                  value={newFeedUrl}
                  onChange={e => setNewFeedUrl(e.target.value)}
                  disabled={validating !== null}
                  aria-describedby={errors.add ? 'add-error' : undefined}
                />
                {validating && (
                  <Loader2 size={18} className="validating-spinner spinning" aria-hidden="true" />
                )}
                {sourceType === 'rss' && (
                  <button
                    type="button"
                    className="discover-btn"
                    onClick={() => void handleDiscover()}
                    disabled={!newFeedUrl.trim() || discovering}
                    aria-label="Discover feeds"
                    title="Discover feeds on this website"
                  >
                    <Search size={16} aria-hidden="true" />
                  </button>
                )}
                <button 
                  type="submit" 
                  className="add-btn"
                  disabled={!newFeedUrl.trim() || validating !== null}
                  aria-label="Add feed"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
              {errors.add && (
                <p id="add-error" className="error-message" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.add}
                </p>
              )}
            </form>
            {discoveryMessage && <p className="discovery-message" role="status">{discoveryMessage}</p>}
            {discovered.length > 0 && (
              <ul className="discovered-list" role="list">
                {discovered.map(source => (
                  <li key={source.url}>
                    <span className={classNames('source-type-badge', source.kind)}>{source.kind}</span>
                    <span>{source.title}</span>
                    <button onClick={() => void handleAddDiscovered(source)}>Add</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="organize-section">
            <div className="section-header-row"><h3><Tag size={15} aria-hidden="true" /> Categories</h3></div>
            <form onSubmit={handleCreateCategory} className="compact-form">
              <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="New category name" aria-label="New category name" />
              <button type="submit" disabled={!newCategory.trim()} aria-label="Create category"><Plus size={15} /></button>
            </form>
            <div className="chip-list">
              {organize.categories.length === 0 && <span className="muted">No categories yet</span>}
              {organize.categories.map(category => (
                <span key={category.id} className="editable-chip">
                  {category.name}
                  <button onClick={() => void organize.renameCategory(category.id, window.prompt('Rename category', category.name) || '')} aria-label={`Rename ${category.name}`}>✎</button>
                  <button onClick={() => { if (window.confirm(`Delete category “${category.name}”? Subscriptions and reading history are kept.`)) void organize.deleteCategory(category.id) }} aria-label={`Delete ${category.name}`}>×</button>
                </span>
              ))}
            </div>
          </section>

          <section className="organize-section">
            <div className="section-header-row"><h3><FolderPlus size={15} aria-hidden="true" /> Custom Feeds</h3></div>
            <form onSubmit={handleCreateView} className="compact-form">
              <input value={newViewName} onChange={e => setNewViewName(e.target.value)} placeholder="New feed name" aria-label="New feed name" />
              <button type="submit" disabled={!newViewName.trim()} aria-label="Create custom feed"><Plus size={15} /></button>
            </form>
            <div className="view-selectors">
              <label>Categories
                <select multiple value={viewCategoryIds} aria-label="Custom feed categories" onChange={e => setViewCategoryIds(Array.from(e.target.selectedOptions, option => option.value))}>
                  {organize.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>Sources
                <select multiple value={viewSourceIds} aria-label="Custom feed sources" onChange={e => setViewSourceIds(Array.from(e.target.selectedOptions, option => option.value))}>
                  {feeds.map(feed => <option key={feed.id || feed.url} value={feed.id || feed.url}>{feed.title}</option>)}
                </select>
              </label>
              <label>Content
                <select value={viewContentType} aria-label="Custom feed content type" onChange={e => setViewContentType(e.target.value as ContentType | 'all')}>
                  <option value="all">All types</option>
                  <option value="article">Articles</option>
                  <option value="video">Videos</option>
                  <option value="post">Posts</option>
                  <option value="image">Images</option>
                  <option value="link">Links</option>
                </select>
              </label>
            </div>
            <div className="chip-list">
              <span className="editable-chip">All feed</span>
              {organize.views.map(view => (
                <span key={view.id} className="editable-chip">
                  {view.name}
                  <button onClick={() => void organize.updateView(view.id, { name: window.prompt('Rename feed', view.name) || view.name })} aria-label={`Rename ${view.name}`}>✎</button>
                  <button onClick={() => void organize.deleteView(view.id)} aria-label={`Delete ${view.name}`}>×</button>
                </span>
              ))}
            </div>
            <div className="opml-actions">
              <button onClick={() => void handleImport()} aria-label="Import OPML"><Upload size={14} /> Import OPML</button>
              <button onClick={() => void handleExport()} aria-label="Export OPML"><Download size={14} /> Export OPML</button>
            </div>
          </section>

          <section className="feeds-list-section">
            <div className="section-header-row">
              <h3>Subscribed Feeds ({feeds.length})</h3>
              {feeds.length > 0 && (
                <button
                  className="refresh-all-btn"
                  onClick={handleRefreshAll}
                  disabled={refreshingAll}
                  aria-label="Refresh all feeds"
                >
                  <Loader2 size={16} className={refreshingAll ? 'spinning' : ''} aria-hidden="true" />
                  Refresh All
                </button>
              )}
            </div>
            {errors.all && <p className="error-message" role="alert">{errors.all}</p>}

            {loading ? (
              <div className="loading-feeds">
                <Loader2 size={32} className="spinning" aria-hidden="true" />
                <p>Loading feeds…</p>
              </div>
            ) : feeds.length === 0 ? (
              <div className="empty-feeds">
                <LinkIcon size={48} aria-hidden="true" />
                <p>No feeds added yet</p>
                <span>Add an RSS feed, YouTube channel or Reddit community above to get started</span>
              </div>
            ) : (
              <ul className="feeds-list" role="list">
                {feeds.map(feed => (
                  <li key={feed.url} className="feed-item">
                    <div className="feed-info">
                      <label className="feed-toggle">
                        <input
                          type="checkbox"
                          checked={feed.enabled}
                          disabled={validating !== null || refreshingAll}
                          onChange={() => handleToggleFeed(feed.url)}
                          aria-label={feed.enabled ? `Disable ${feed.title || getDomain(feed.url)}` : `Enable ${feed.title || getDomain(feed.url)}`}
                        />
                        <span className="toggle-slider" />
                      </label>
                      <div className="feed-details">
                        <div className="feed-title-row">
                          <span className={classNames('source-type-badge', feed.type || 'rss')}>{feed.type || 'rss'}</span>
                          <strong>{feed.title || getDomain(feed.url)}</strong>
                          <span className="feed-domain">({getDomain(feed.sourceUrl || feed.url)})</span>
                        </div>
                        <div className="feed-meta">
                          <span className={classNames('status-badge', feed.enabled ? 'enabled' : 'disabled')}>
                            {feed.enabled ? 'Active' : 'Disabled'}
                          </span>
                          {!feed.lastFetched && <span>Not checked yet</span>}
                          {feed.lastFetched && (
                            <time dateTime={feed.lastFetched}>
                              Last checked: {new Date(feed.lastFetched).toLocaleString()}
                            </time>
                          )}
                        </div>
                        <div className="feed-category-assign" aria-label={`Categories for ${feed.title}`}>
                          {organize.categories.length > 0 && <span className="feed-category-label">Categories:</span>}
                          {organize.categories.map(category => (
                            <label key={category.id} className={classNames('category-toggle', (feed.categoryIds || []).includes(category.id) && 'active')}>
                              <input
                                type="checkbox"
                                checked={(feed.categoryIds || []).includes(category.id)}
                                onChange={() => void organize.assignCategories(feed.url, (feed.categoryIds || []).includes(category.id) ? (feed.categoryIds || []).filter(value => value !== category.id) : [...(feed.categoryIds || []), category.id])}
                              />
                              {category.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="feed-actions">
                      <button
                        className="icon-btn refresh-btn"
                        onClick={() => handleRefreshFeed(feed.url)}
                        disabled={validating !== null || refreshingAll}
                        aria-label="Refresh feed"
                      >
                        {validating === feed.url ? (
                          <Loader2 size={16} className="spinning" aria-hidden="true" />
                        ) : (
                          <Loader2 size={16} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        className="icon-btn delete-btn"
                        onClick={() => handleRemoveFeed(feed.url)}
                        disabled={validating !== null || refreshingAll}
                        aria-label={`Remove ${feed.title || getDomain(feed.url)}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                    {(errors[feed.url] || feed.lastError) && (
                      <div className="feed-error" role="alert">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors[feed.url] || feed.lastError}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

      </div>
    </main>
  )
}
