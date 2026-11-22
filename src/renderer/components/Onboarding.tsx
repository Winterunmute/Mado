import { useEffect, useRef } from 'react'
import { Rss, MessageCircle, SlidersHorizontal, ArrowRight } from 'lucide-react'
import './Onboarding.css'

interface Props {
  onFinish: (addSource: boolean) => void
}

export default function Onboarding({ onFinish }: Props) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onFinish(false)
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]') || [])
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="onboarding-backdrop" onKeyDown={handleKeyDown}>
      <section
        className="onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <span className="onboarding-kicker">Welcome to Mado</span>
        <h2 id="onboarding-title">Your window to the world.</h2>
        <p className="onboarding-intro">A quiet place to read what you choose and chat with people you know. No algorithm decides what comes next.</p>

        <div className="onboarding-concepts">
          <article>
            <Rss size={22} aria-hidden="true" />
            <h3>Your Feed</h3>
            <p>Follow RSS/Atom sites, YouTube channels and Reddit communities. Add sources from <strong>Sources → Add Source</strong>.</p>
          </article>
          <article>
            <MessageCircle size={22} aria-hidden="true" />
            <h3>Your Messenger</h3>
            <p>Open the Messenger panel and sign in with your existing Facebook account whenever you are ready. Mado does not ask first.</p>
          </article>
          <article>
            <SlidersHorizontal size={22} aria-hidden="true" />
            <h3>Your Rules</h3>
            <p>Categories, Saved and custom feeds keep things tidy. The feed stays chronological and never ranks or recommends.</p>
          </article>
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-secondary" onClick={() => onFinish(false)}>Skip for now</button>
          <button className="onboarding-primary" onClick={() => onFinish(true)}>
            Add a source <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  )
}
