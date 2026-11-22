import { useState, useEffect } from 'react'
import { StoreProvider, useSettings } from './hooks/useStore'
import Sidebar from './components/Sidebar'
import FeedArea from './components/FeedArea'
import Settings from './components/Settings'
import FeedManager from './components/FeedManager'
import MessengerPanel from './components/MessengerPanel'
import Onboarding from './components/Onboarding'
import { api } from './lib/api'
import type { ViewMode } from './types'

function AppContent() {
  const [activeView, setActiveView] = useState<ViewMode>('feed')
  const { messengerVisible, messengerWidth, setMessengerVisible, onboardingComplete, loading, setOnboardingComplete } = useSettings()

  useEffect(() => {
    const handler = () => setActiveView('sources')
    window.addEventListener('open-feed-manager', handler)
    return () => window.removeEventListener('open-feed-manager', handler)
  }, [])

  useEffect(() => api.desktop.onShortcut(action => {
    if (action === 'open-feed') setActiveView('feed')
    else if (action === 'open-sources') setActiveView('sources')
    else if (action === 'open-settings') setActiveView('settings')
    else if (action === 'toggle-messenger') setMessengerVisible(!messengerVisible)
    else window.dispatchEvent(new CustomEvent(`shortcut:${action}`))
  }), [messengerVisible, setMessengerVisible])

  const finishOnboarding = (addSource: boolean) => {
    setOnboardingComplete(true)
    if (addSource) window.dispatchEvent(new CustomEvent('open-feed-manager'))
  }

  const renderView = () => {
    switch (activeView) {
      case 'feed':
        return <FeedArea />
      case 'sources':
        return <FeedManager />
      case 'settings':
        return <Settings />
      default:
        return <FeedArea />
    }
  }

  return (
    <div className="app">
      <div className="app-titlebar">Mado <span>Your window to the world.</span></div>
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="main-area">
        {renderView()}
        <div
          className="messenger-space"
          style={{ width: messengerVisible ? messengerWidth : 44 }}
          aria-hidden="true"
        />
        <MessengerPanel />
      </div>
      {!loading && !onboardingComplete && <Onboarding onFinish={finishOnboarding} />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  )
}
