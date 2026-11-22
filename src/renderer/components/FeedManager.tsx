import React, { useState } from 'react'
import { Plus, Trash2, Loader2, AlertCircle, Link as LinkIcon, Rss, Youtube, MessageCircle } from 'lucide-react'
import { useFeeds } from '../hooks/useStore'
import type { SourceType } from '../types'
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
