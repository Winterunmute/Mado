const NOTIFICATION_ORIGINS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'messenger.com',
  'www.messenger.com',
])

export function isNotificationOriginAllowed(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' &&
      NOTIFICATION_ORIGINS.has(url.hostname.toLowerCase()) &&
      !url.username && !url.password
  } catch {
    return false
  }
}

// Only the benign numeric prefix is read. Sender names, message text and the
// rest of the title are deliberately ignored and never logged or persisted.
export function unreadCountFromTitle(title: string): number {
  const match = /^\s*\((\d+)\)\s*/.exec(title || '')
  if (!match) return 0
  const count = Number.parseInt(match[1], 10)
  return Number.isFinite(count) ? Math.min(99, count) : 0
}

export function shouldShowUnreadNotification(options: {
  enabled: boolean
  count: number
  previousCount: number
  messengerFocused: boolean
  now: number
  lastNotifiedAt: number
}): boolean {
  if (!options.enabled || options.count <= 0 || options.count <= options.previousCount) return false
  if (options.messengerFocused) return false
  return options.now - options.lastNotifiedAt >= 10_000
}
