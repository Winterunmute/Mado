import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import type { Article, ReaderResult } from '../types'
import { api } from '../lib/api'
import { formatDateFull } from '../lib/utils'
import './ArticleReader.css'

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
}

export default function ArticleReader({ article, onBack }: { article: Article; onBack: () => void }) {
  const [result, setResult] = useState<ReaderResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [externalError, setExternalError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let active = true
    setResult(null)
    setError(null)
    heading.current?.focus({ preventScroll: true })
    if (article.sourceType === 'reddit' || article.contentType === 'video') {
      setResult({
        title: article.title,
        html: article.sourceType === 'reddit' ? article.contentHtml || `<p>${escapeText(article.description)}</p>` : '',
        byline: article.author,
        url: article.link,
        mode: 'feed',
        notice: article.sourceType === 'reddit' ? 'Showing the text supplied by this Reddit post.' : null,
      })
      return
    }
    void api.articles.read(article.id || article.link).then(data => {
      if (active) setResult(data)
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [article.link])

  const openExternal = async (url: string) => {
    setExternalError(null)
    try { await api.shell.openExternal(url) }
    catch (e: any) { setExternalError(e.message || 'Could not open your browser. Please try again.') }
  }

  return (
    <section className="article-reader" aria-label="Article reader">
      <header className="reader-toolbar">
        <button className="btn secondary" onClick={onBack}><ArrowLeft size={16} /> Back to Feed</button>
        <button className="btn secondary" onClick={() => void openExternal(article.link)}><ExternalLink size={16} /> Open in Browser</button>
      </header>
      <div className="reader-scroll">
        <article className="reader-page">
          <div className="reader-meta"><span>{article.feedTitle}</span><time dateTime={article.pubDate}>{formatDateFull(article.pubDate)}</time></div>
          <h1 ref={heading} tabIndex={-1}>{result?.title || article.title}</h1>
          {result?.byline && <p className="reader-byline">{result.byline}</p>}
          <a className="reader-original" href={article.link} onClick={e => { e.preventDefault(); void openExternal(article.link) }}>{article.link}</a>
          {externalError && <p className="reader-notice" role="alert">{externalError}</p>}
          {!result && !error && <div className="reader-loading" role="status"><Loader2 size={20} className="spinning" /> Preparing article…</div>}
          {error && <div className="reader-notice" role="alert"><AlertCircle size={18} /><p>{error} You can still open the original in your browser.</p></div>}
          {result?.notice && <div className="reader-notice" role="status"><AlertCircle size={18} /><p>{result.notice}</p></div>}
          {article.contentType === 'video' && result && (
            <div className="video-view">
              {article.thumbnail && <img src={article.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />}
              <p>Watch this video on YouTube in your browser. Mado never autoplays embedded video.</p>
              <button className="btn primary" onClick={() => void openExternal(article.link)}>Watch on YouTube <ExternalLink size={14} /></button>
            </div>
          )}
          {article.sourceType === 'reddit' && result && (
            <button className="reader-discussion" onClick={() => void openExternal(article.link)}>View Discussion on Reddit <ExternalLink size={13} /></button>
          )}
          {result && article.contentType !== 'video' && <div className="reader-body"
            onClick={e => {
              const link = (e.target as HTMLElement).closest('a')
              if (link) { e.preventDefault(); if (link.href) void openExternal(link.href) }
            }}
            onAuxClick={e => {
              const link = (e.target as HTMLElement).closest('a')
              if (link) { e.preventDefault(); if (e.button === 1 && link.href) void openExternal(link.href) }
            }}
            onErrorCapture={e => { if (e.target instanceof HTMLImageElement) e.target.hidden = true }}
            // Only main-process allowlisted, sanitized content is accepted here.
            dangerouslySetInnerHTML={{ __html: result.html }}
          />}
          <footer className="reader-footer">Published by {article.feedTitle}. <button onClick={() => void openExternal(article.link)}>Visit the original article <ExternalLink size={13} /></button></footer>
        </article>
      </div>
    </section>
  )
}
