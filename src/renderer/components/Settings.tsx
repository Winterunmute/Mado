import React, { useState } from 'react'
import { 
  Palette, 
  Layout, 
  MessageSquare, 
  RefreshCw, 
  Database,
  Trash2,
  AlertCircle,
  CheckCircle,
  PanelTop,
  Bell,
  Keyboard,
  Download,
  HelpCircle,
  ExternalLink
} from 'lucide-react'
import { SHORTCUT_HELP } from '../../main/shortcuts'
import { api } from '../lib/api'
import { useSettings } from '../hooks/useStore'
import { classNames } from '../lib/utils'
import type { UpdateCheckResult } from '../types'
import './Settings.css'

export default function Settings() {
  const { 
    theme, 
    feedDensity, 
    messengerWidth, 
    messengerVisible,
    autoRefreshInterval,
    showReadArticles,
    setTheme,
    setFeedDensity,
    setMessengerWidth,
    setMessengerVisible,
    setAutoRefreshInterval,
    setShowReadArticles,
    trayEnabled,
    closeToTray,
    startMinimized,
    messengerNotifications,
    setTrayEnabled,
    setCloseToTray,
    setStartMinimized,
    setMessengerNotifications,
    setOnboardingComplete
  } = useSettings()

  const handleResetData = async () => {
    if (!confirm('This removes all subscriptions, categories, saved items, custom feeds, conversation tabs, read history, window state and preferences. Your Facebook Messenger session is kept. Continue?')) return
    if (!confirm('This action cannot be undone. Please confirm again.')) return
    
    try {
      await api.app.reset()
      window.location.reload()
    } catch (e) {
      console.error('Failed to reset:', e)
      alert('Failed to reset data')
    }
  }

  const handleExportConfig = async () => {
    try {
      const path = await api.config.export()
      if (path) alert(`Mado configuration exported to:\n${path}`)
    } catch (e) {
      alert('Could not export configuration')
    }
  }

  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [checkingUpdates, setCheckingUpdates] = useState(false)

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true)
    try {
      setUpdateResult(await api.updates.check())
    } catch {
      setUpdateResult({
        configured: true,
        available: false,
        currentVersion: '1.0.1',
        latestVersion: null,
        releaseUrl: null,
        message: 'Update check failed.',
      })
    } finally {
      setCheckingUpdates(false)
    }
  }

  return (
    <main className="settings" role="main">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Customize your Mado experience</p>
      </header>

      <div className="settings-content">
        <section className="settings-section">
          <div className="section-header">
            <Palette size={20} aria-hidden="true" />
            <h2>Appearance</h2>
          </div>
          
          <div className="setting-group">
            <label className="setting-label">
              <span>Theme</span>
              <p className="setting-hint">Choose your preferred color scheme</p>
            </label>
            <div className="theme-options" role="radiogroup" aria-label="Theme">
              <button
                className={classNames('theme-option', theme === 'dark' && 'active')}
                onClick={() => setTheme('dark')}
                role="radio"
                aria-checked={theme === 'dark'}
              >
                <div className="theme-preview dark" />
                <span>Dark</span>
              </button>
              <button
                className={classNames('theme-option', theme === 'light' && 'active')}
                onClick={() => setTheme('light')}
                role="radio"
                aria-checked={theme === 'light'}
              >
                <div className="theme-preview light" />
                <span>Light</span>
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <span>Feed Density</span>
              <p className="setting-hint">Adjust article card spacing and size</p>
            </label>
            <select
              value={feedDensity}
              aria-label="Feed density"
              onChange={(e) => setFeedDensity(e.target.value as any)}
              className="setting-select"
            >
              <option value="compact">Compact — More articles visible</option>
              <option value="comfortable">Comfortable — Balanced</option>
              <option value="spacious">Spacious — Relaxed reading</option>
            </select>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <MessageSquare size={20} aria-hidden="true" />
            <h2>Messenger</h2>
          </div>

          <div className="setting-group">
            <label className="setting-label toggle-label">
              <span>Show Messenger Panel</span>
              <p className="setting-hint">Display Facebook Messenger in the right panel</p>
            </label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={messengerVisible}
                aria-label="Show Messenger panel"
                onChange={(e) => setMessengerVisible(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <span>Panel Width: {messengerWidth}px</span>
              <p className="setting-hint">Drag the panel edge to resize, or adjust here</p>
            </label>
            <input
              type="range"
              min="320"
              max="600"
              step="20"
              value={messengerWidth}
              aria-label="Messenger panel width"
              onChange={(e) => setMessengerWidth(Number(e.target.value))}
              className="setting-range"
            />
            <div className="range-labels">
              <span>320px</span>
              <span>600px</span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <PanelTop size={20} aria-hidden="true" />
            <h2>Desktop</h2>
          </div>

          <div className="setting-group">
            <label className="setting-label toggle-label">
              <span>Show tray icon</span>
              <p className="setting-hint">Keep a Mado icon in the Windows system tray</p>
            </label>
            <label className="toggle-switch">
              <input type="checkbox" checked={trayEnabled} aria-label="Enable system tray" onChange={e => setTrayEnabled(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label toggle-label">
              <span>Close to tray</span>
              <p className="setting-hint">Closing the window hides Mado instead of exiting. Tray icon is enabled automatically.</p>
            </label>
            <label className="toggle-switch">
              <input type="checkbox" checked={closeToTray} aria-label="Close to tray" onChange={e => setCloseToTray(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label toggle-label">
              <span>Start minimized</span>
              <p className="setting-hint">Launch hidden in the tray. Requires the tray icon or close-to-tray.</p>
            </label>
            <label className="toggle-switch">
              <input type="checkbox" checked={startMinimized} aria-label="Start minimized" onChange={e => setStartMinimized(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <Bell size={20} aria-hidden="true" />
            <h2>Notifications</h2>
          </div>

          <div className="setting-group">
            <label className="setting-label toggle-label">
              <span>Messenger activity alerts</span>
              <p className="setting-hint">Show a private Windows notification when Messenger's unread indicator increases. No message previews are read or displayed.</p>
            </label>
            <label className="toggle-switch">
              <input type="checkbox" checked={messengerNotifications} aria-label="Messenger notifications" onChange={e => setMessengerNotifications(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <Keyboard size={20} aria-hidden="true" />
            <h2>Keyboard shortcuts</h2>
          </div>
          <div className="setting-group shortcut-list">
            {SHORTCUT_HELP.map(shortcut => (
              <div className="shortcut-row" key={shortcut.keys}>
                <kbd>{shortcut.keys}</kbd><span>{shortcut.action}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <RefreshCw size={20} aria-hidden="true" />
            <h2>Feeds</h2>
          </div>

          <div className="setting-group">
            <label className="setting-label toggle-label">
              <span>Auto Refresh</span>
              <p className="setting-hint">Automatically fetch new articles on interval</p>
            </label>
            <select
              value={autoRefreshInterval}
              aria-label="Auto refresh interval"
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="setting-select"
            >
              <option value={0}>Off (Manual only)</option>
              <option value={300000}>Every 5 minutes</option>
              <option value={900000}>Every 15 minutes</option>
              <option value={1800000}>Every 30 minutes</option>
              <option value={3600000}>Every hour</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label toggle-label">
              <span>Show Read Articles</span>
              <p className="setting-hint">Display articles you've already read in the feed</p>
            </label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showReadArticles}
                aria-label="Show read articles"
                onChange={(e) => setShowReadArticles(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-group">
            <button className="btn secondary manage-feeds-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-feed-manager'))}>
              <Layout size={16} /> Manage Feeds
            </button>
          </div>
        </section>

        <section className="settings-section danger-zone">
          <div className="section-header">
            <AlertCircle size={20} aria-hidden="true" />
            <h2>Data & Privacy</h2>
          </div>

          <div className="setting-group">
            <p className="data-info">
              All data is stored locally on your device. No cloud sync, no accounts, no tracking.
            </p>
            <ul className="data-list">
              <li><CheckCircle size={14} /> RSS feed subscriptions</li>
              <li><CheckCircle size={14} /> Article read/unread state</li>
              <li><CheckCircle size={14} /> Saved content, categories and custom feeds</li>
              <li><CheckCircle size={14} /> App preferences</li>
              <li><CheckCircle size={14} /> Messenger session (Facebook's cookies)</li>
            </ul>
          </div>

          <div className="setting-group">
            <button className="btn secondary" onClick={() => void handleExportConfig()} aria-label="Export Mado configuration">
              <Download size={16} /> Export Mado Configuration
            </button>
            <p className="danger-hint">Exports subscriptions, categories, saved items, custom feeds and preferences. Never includes Messenger cookies or messages.</p>
          </div>

          <div className="setting-group">
            <button className="btn danger" onClick={handleResetData}>
              <Trash2 size={16} /> Reset All Data
            </button>
            <p className="danger-hint">Deletes feeds, categories, saved items, custom feeds, read state and settings. Cannot be undone.</p>
          </div>
        </section>

        <section className="settings-section about-section">
          <div className="about-card">
            <div className="about-logo">
              <span>窓</span>
            </div>
            <h3>Mado v1.0.1</h3>
            <p className="about-tagline">Your window to the world.</p>
            <p className="about-desc">
              A personal desktop application combining curated RSS, YouTube and Reddit feeds with Facebook Messenger.
              Built with Electron, React, and TypeScript.
            </p>
            <div className="about-updates">
              <button className="btn secondary" onClick={() => void handleCheckUpdates()} disabled={checkingUpdates} aria-label="Check for updates">
                <RefreshCw size={15} className={checkingUpdates ? 'spin' : ''} /> {checkingUpdates ? 'Checking…' : 'Check for Updates'}
              </button>
              {updateResult && (
                <div className="update-result" role="status">
                  <span>{updateResult.message}</span>
                  {updateResult.available && updateResult.releaseUrl && (
                    <button className="btn link" onClick={() => void api.updates.open(updateResult.releaseUrl!)}>
                      Open release page <ExternalLink size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <button className="btn link about-help" onClick={() => setOnboardingComplete(false)} aria-label="Reopen welcome guide">
              <HelpCircle size={15} /> Reopen welcome guide
            </button>
            <div className="about-links">
              <a href="https://github.com/Winterunmute/Mado" target="_blank" rel="noopener noreferrer">GitHub</a>
              <span className="divider" aria-hidden="true">·</span>
              <a href="https://electronjs.org" target="_blank" rel="noopener noreferrer">Electron</a>
              <span className="divider" aria-hidden="true">·</span>
              <a href="https://react.dev" target="_blank" rel="noopener noreferrer">React</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
