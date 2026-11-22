import { useState } from 'react'
import { BookOpen, Clock, Bookmark, BookmarkCheck, Play, MessageCircle } from 'lucide-react'
import { formatDate, classNames } from '../lib/utils'
import type { Article } from '../types'
import './ArticleCard.css'
import { useStore } from '../hooks/useStore'

interface ArticleCardProps {
  article: Article
  density: 'compact' | 'comfortable' | 'spacious'
  onOpen: (article: Article) => void
}

const DENSITY_CLASSES = {
  compact: 'density-compact',
  comfortable: 'density-comfortable',
  spacious: 'density-spacious',
}

export default function ArticleCard({ article, density, onOpen }: ArticleCardProps) {
  const { markRead } = useStore()
  const isRead = article.isRead
  const [thumbnailFailed, setThumbnailFailed] = useState(false)

  const handleReadToggle = async () => {
    await markRead(article.id || article.link, !isRead)
  }

  const handleOpen = () => onOpen(article)

  const densityClass = DENSITY_CLASSES[density]
  let thumbnailUrl: string | null = null
  if (article.thumbnail && !thumbnailFailed) {
    try {
      const parsedThumbnail = new URL(article.thumbnail)
      if (parsedThumbnail.protocol === 'https:' || parsedThumbnail.protocol === 'http:') {
        thumbnailUrl = parsedThumbnail.toString()
      }
    } catch {
      thumbnailUrl = null
    }
  }

  return (
    <article 
      className={classNames('article-card', densityClass, isRead && 'read', `content-${article.contentType || 'article'}`)}
    >
      <div className="card-main">
        {!thumbnailUrl && article.contentType === 'video' && (
          <span className="card-thumbnail-wrap video-placeholder">
            <span className="play-indicator" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
          </span>
        )}
        {thumbnailUrl && (
          <span className="card-thumbnail-wrap">
            <img
              className="card-thumbnail"
              src={thumbnailUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setThumbnailFailed(true)}
            />
            {article.contentType === 'video' && <span className="play-indicator" aria-hidden="true"><Play size={18} fill="currentColor" /></span>}
          </span>
        )}
        
        <div className="card-content">
          <div className="card-meta">
            <span className="card-source" title={article.feedTitle}>
              {article.feedTitle}
            </span>
            {article.contentType === 'video' && <span className="card-type-label"><Play size={11} /> Video</span>}
            {article.sourceType === 'reddit' && <span className="card-type-label"><MessageCircle size={11} /> {article.author || 'post'}</span>}
            <time className="card-date" dateTime={article.pubDate}>
              <Clock size={12} aria-hidden="true" />
              {formatDate(article.pubDate)}
            </time>
          </div>

          <h2><button type="button" className="card-title" onClick={handleOpen}>{article.title}</button></h2>

          <p className="card-description">
            {article.description}
          </p>

          <div className="card-actions">
            <button
              className={classNames('action-btn', isRead && 'read')}
              onClick={handleReadToggle}
              aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
              aria-pressed={isRead}
            >
              {isRead ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              <span>{isRead ? 'Read' : 'Unread'}</span>
            </button>
            
            <button
              className="action-btn primary"
              onClick={handleOpen}
              aria-label={`Open ${article.title}`}
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>{article.contentType === 'video' ? 'Watch' : article.sourceType === 'reddit' ? 'View post' : 'Read more'}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
