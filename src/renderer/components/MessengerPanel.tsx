import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  MessageSquare,
  Plus,
  List,
  Star,
  X,
  AlertCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react'
import { conversationLabel } from '../../main/conversation-tabs'
import { api } from '../lib/api'
import { useSettings } from '../hooks/useStore'
import type { ConversationTab, MessengerLocation } from '../types'
import './MessengerPanel.css'

const EMPTY_LOCATION: MessengerLocation = { url: null, key: null, isList: false }

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export default function MessengerPanel() {
  const { messengerVisible, messengerWidth, setMessengerVisible, setMessengerWidth } = useSettings()
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<{ errorCode: number; errorDescription: string; url: string } | null>(null)
  const [navigationBlocked, setNavigationBlocked] = useState(false)
  const [tabs, setTabs] = useState<ConversationTab[]>([])
  const [location, setLocation] = useState<MessengerLocation>(EMPTY_LOCATION)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [messengerUnread, setMessengerUnread] = useState(false)
  const tabsRef = useRef<ConversationTab[]>([])
  const resizing = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  useEffect(() => { tabsRef.current = tabs }, [tabs])

  const handleLocation = useCallback((next: MessengerLocation) => {
    setLocation(next)
    if (next.key) {
      setSelectedId(tabsRef.current.find(tab => tab.key === next.key)?.id ?? null)
    } else {
      setSelectedId(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    void api.messenger.getStatus().then(status => { if (active) setLoaded(status.loaded) })
    void api.messenger.getLocation().then(next => { if (active) handleLocation(next) })
    void api.conversationTabs.get().then(saved => {
      if (!active) return
      setTabs(saved)
      tabsRef.current = saved
    }).catch((error: Error) => {
      if (active) setNotice(`Conversation tabs could not be loaded: ${error.message}`)
    })

    const unloadError = api.messenger.onLoadError(data => {
      setLoadError(data)
      setLoaded(false)
    })
    const unloadLoaded = api.messenger.onLoaded(() => {
      setLoaded(true)
      setLoadError(null)
      setNotice(null)
      // navigationBlocked stays visible until the user chooses a recovery action,
      // so an automatic reload never silently hides the only way back.
    })
    const unloadVisibility = api.messenger.onVisibilityChanged(visible => {
      if (!visible) setLoaded(false)
    })
    const unloadNavigationBlocked = api.messenger.onNavigationBlocked(() => {
      setNavigationBlocked(true)
    })
    const unloadLocation = api.messenger.onLocationChanged(next => {
      if (active) handleLocation(next)
    })
    const unloadUnread = api.messenger.onUnreadChanged(state => {
      if (active) setMessengerUnread(state.active)
    })
    return () => {
      active = false
      unloadError()
      unloadLoaded()
      unloadVisibility()
      unloadNavigationBlocked()
      unloadLocation()
      unloadUnread()
    }
  }, [handleLocation])

  const persist = useCallback((next: ConversationTab[]) => {
    setTabs(next)
    tabsRef.current = next
    void api.conversationTabs.save(next).catch((error: Error) => {
      setNotice(`Conversation tabs could not be saved: ${error.message}`)
    })
  }, [])

  const recover = useCallback(() => {
    setNavigationBlocked(false)
    setLoadError(null)
    setNotice(null)
    void api.messenger.markSeen()
    void api.messenger.backToMessenger()
  }, [])

  const openConversation = useCallback(async (tab: ConversationTab) => {
    setSelectedId(tab.id)
    setNotice(null)
    setNavigationBlocked(false)
    void api.messenger.markSeen()
    try {
      await api.messenger.navigate(tab.url)
    } catch {
      setNotice('This conversation link is no longer valid. Use Recover to return to Messages.')
    }
  }, [])

  const openList = useCallback(async () => {
    setSelectedId(null)
    setNotice(null)
    setNavigationBlocked(false)
    void api.messenger.markSeen()
    await api.messenger.backToMessenger()
  }, [])

  const saveCurrent = useCallback(() => {
    if (!location.key || !location.url) return
    const existing = tabsRef.current.find(tab => tab.key === location.key)
    if (existing) {
      setSelectedId(existing.id)
      return
    }
    const tab: ConversationTab = {
      id: makeId(),
      key: location.key,
      url: location.url,
      label: conversationLabel(location.key),
      pinned: false,
    }
    persist([...tabsRef.current, tab])
    setSelectedId(tab.id)
    void api.messenger.markSeen()
  }, [location.key, location.url, persist])

  const togglePin = useCallback((id: string) => {
    persist(tabsRef.current.map(tab => tab.id === id ? { ...tab, pinned: !tab.pinned } : tab))
  }, [persist])

  const closeTab = useCallback((id: string) => {
    setEditingId(current => current === id ? null : current)
    const remaining = tabsRef.current.filter(tab => tab.id !== id)
    persist(remaining)
    if (selectedId === id) {
      setSelectedId(null)
      void api.messenger.backToMessenger()
    }
  }, [persist, selectedId])

  const commitRename = useCallback((id: string) => {
    const label = draftLabel.trim().slice(0, 40)
    if (label) persist(tabsRef.current.map(tab => tab.id === id ? { ...tab, label } : tab))
    setEditingId(null)
  }, [draftLabel, persist])

  if (!messengerVisible) {
    return (
      <button
        className="messenger-tab"
        onClick={() => setMessengerVisible(true)}
        aria-label="Open Messenger"
      >
        <MessageSquare size={20} />
      </button>
    )
  }

  const activeId = selectedId ?? (location.key ? tabs.find(tab => tab.key === location.key)?.id ?? null : null)
  const listActive = !location.key && location.isList
  const alreadySaved = !!location.key && tabs.some(tab => tab.key === location.key)
  const needsRecovery = navigationBlocked || !!loadError || !!notice

  return (
    <aside className="messenger-panel" ref={panelRef} style={{ width: messengerWidth }}>
      <div className="panel-header">
        <span
          className={classNames('header-brand', messengerUnread && 'unread')}
          title={messengerUnread ? 'Messenger has unread activity' : 'Messenger'}
          aria-hidden="true"
        >
          <MessageSquare size={15} />
          {messengerUnread && <span className="unread-dot" />}
        </span>

        <div className="conv-tab-strip" role="tablist" aria-label="Messenger conversations">
          <button
            type="button"
            className={classNames('conv-tab', 'chats-tab', listActive && 'active')}
            role="tab"
            aria-selected={listActive}
            onClick={() => void openList()}
            title="Messenger conversation list"
          >
            <List size={12} aria-hidden="true" />
            <span className="tab-label">Chats</span>
          </button>

          {tabs.map(tab => (
            <div
              key={tab.id}
              className={classNames('conv-tab', activeId === tab.id && 'active', tab.pinned && 'pinned')}
              role="presentation"
            >
              {editingId === tab.id ? (
                <input
                  className="tab-rename"
                  aria-label="Conversation tab name"
                  value={draftLabel}
                  autoFocus
                  maxLength={40}
                  onChange={event => setDraftLabel(event.target.value)}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') commitRename(tab.id)
                    if (event.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="tab-main"
                  role="tab"
                  aria-selected={activeId === tab.id}
                  onClick={() => void openConversation(tab)}
                  onDoubleClick={() => { setDraftLabel(tab.label); setEditingId(tab.id) }}
                  title={`${tab.label} — double-click to rename`}
                >
                  {tab.pinned && <Star size={10} fill="currentColor" aria-hidden="true" />}
                  <span className="tab-label">{tab.label}</span>
                </button>
              )}
              <button
                type="button"
                className="tab-action"
                aria-label={tab.pinned ? `Unpin ${tab.label}` : `Pin ${tab.label}`}
                aria-pressed={tab.pinned}
                title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                onClick={() => togglePin(tab.id)}
              >
                <Star size={11} fill={tab.pinned ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="tab-action"
                aria-label={`Close ${tab.label} tab`}
                title="Close tab (the Facebook conversation is not affected)"
                onClick={() => closeTab(tab.id)}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="header-btn"
            aria-label="Save current conversation"
            title={alreadySaved ? 'This conversation is already saved' : 'Save this conversation as a tab'}
            disabled={!location.key || alreadySaved}
            onClick={saveCurrent}
          >
            <Plus size={15} />
          </button>
          {needsRecovery && (
            <button
              type="button"
              className="header-btn recovery-alert"
              aria-label="Recover Messenger"
              title={notice || 'Messenger is outside the messaging view. Return to Messages.'}
              onClick={recover}
            >
              <AlertCircle size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="panel-content">
        {loadError && (
          <div className="error-state" role="alert">
            <div className="error-icon"><AlertCircle size={48} /></div>
            <h3>Unable to load Messenger</h3>
            <p>{loadError.errorDescription || 'Failed to load Facebook Messenger'}</p>
            <div className="error-details">
              <code>{loadError.url}</code>
              <span>Error code: {loadError.errorCode}</span>
            </div>
            <div className="error-actions">
              <button className="btn primary" onClick={recover}><RotateCcw size={14} /> Return to Messages</button>
              <button className="btn secondary" onClick={() => void api.shell.openExternal('https://www.facebook.com/messages/')}>
                <ExternalLink size={14} /> Open in Browser
              </button>
            </div>
          </div>
        )}

        {!loadError && (
          <div className="messenger-placeholder">
            <div className="placeholder-content">
              {loaded ? (
                <>
                  <MessageSquare size={48} className="success-icon" />
                  <h3>Messenger Loaded</h3>
                  <p>Facebook Messenger is running in the embedded view on the right.</p>
                  <p className="hint">Use the conversation tabs above to switch chats.</p>
                </>
              ) : (
                <>
                  <RotateCcw size={48} className="spinning" />
                  <h3>Loading Messenger…</h3>
                  <p>Please wait while Facebook Messenger loads.</p>
                  <p className="hint">You may need to log in if this is your first time.</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className="resize-handle"
        onPointerDown={event => {
          resizing.current = true
          startXRef.current = event.clientX
          startWidthRef.current = messengerWidth
          event.currentTarget.setPointerCapture(event.pointerId)
          event.preventDefault()
        }}
        onPointerMove={event => {
          if (resizing.current) {
            setMessengerWidth(Math.max(320, Math.min(600, startWidthRef.current + startXRef.current - event.clientX)))
          }
        }}
        onPointerUp={() => { resizing.current = false }}
        onPointerCancel={() => { resizing.current = false }}
        onLostPointerCapture={() => { resizing.current = false }}
        aria-label="Resize Messenger panel"
        role="slider"
        aria-valuemin={320}
        aria-valuemax={600}
        aria-valuenow={messengerWidth}
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); setMessengerWidth(Math.min(600, messengerWidth + 20)) }
          if (event.key === 'ArrowRight') { event.preventDefault(); setMessengerWidth(Math.max(320, messengerWidth - 20)) }
        }}
      >
        <div className="resize-grip" />
      </div>
    </aside>
  )
}
