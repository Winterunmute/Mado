import React, { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { 
  Home, 
  Rss, 
  Settings, 
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon
} from 'lucide-react'
import { useSettings, useTheme } from '../hooks/useStore'
import type { ViewMode } from '../types'
import './Sidebar.css'

const NAV_ITEMS: { id: ViewMode; label: string; icon: LucideIcon }[] = [
  { id: 'feed', label: 'Home', icon: Home },
  { id: 'sources', label: 'Sources', icon: Rss },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ activeView, onViewChange }: { activeView: ViewMode; onViewChange: (view: ViewMode) => void }) {
  const { messengerVisible, setMessengerVisible } = useSettings()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={classNames('sidebar', collapsed && 'collapsed')}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="logo">
            <span className="logo-mark">窓</span>
            <span className="logo-text">Mado</span>
          </div>
        )}
        <button 
          className="collapse-btn" 
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
        <ul>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                className={classNames('nav-item', activeView === id && 'active')}
                onClick={() => onViewChange(id)}
                aria-label={label}
                aria-current={activeView === id ? 'page' : undefined}
                title={collapsed ? label : ''}
              >
                <Icon size={20} aria-hidden="true" />
                {!collapsed && <span>{label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {!collapsed && (
        <div className="sidebar-divider" />
      )}

      {!collapsed && (
        <div className="sidebar-section">
          <div className="section-header">Messenger</div>
          <button
            className={classNames('messenger-toggle', messengerVisible && 'active')}
            onClick={() => setMessengerVisible(!messengerVisible)}
            aria-pressed={messengerVisible}
          >
            <MessageSquare size={18} aria-hidden="true" />
            <span>{messengerVisible ? 'Hide' : 'Show'} Messenger</span>
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="sidebar-divider" />
      )}

      {!collapsed && (
        <div className="sidebar-section">
          <div className="section-header">Appearance</div>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
      )}

      <div className="sidebar-footer">
        {!collapsed && <span className="version">v0.6.0</span>}
      </div>
    </aside>
  )
}

function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
