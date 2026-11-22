const FACEBOOK_HOST = 'facebook.com'
const FACEBOOK_AUTH_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
])
const REDIRECT_HOSTS = new Set([
  'l.facebook.com',
  'lm.facebook.com',
  'l.messenger.com',
])
const REDIRECT_PARAMETERS = ['u', 'url', 'next']
const MAX_REDIRECT_DEPTH = 5

export type MessengerNavigationDecision =
  | { kind: 'allow'; url: string }
  | { kind: 'external'; url: string }
  | { kind: 'block'; url: string }

function isFacebookHost(hostname: string): boolean {
  return hostname === FACEBOOK_HOST || hostname.endsWith(`.${FACEBOOK_HOST}`)
}

function isMessengerPath(pathname: string): boolean {
  return /^\/messages(?:\/|$)/i.test(pathname)
}

function isAuthenticationPath(pathname: string): boolean {
  return /^\/(?:login|checkpoint|two_step_verification|recover|privacy\/consent)(?:\/|$)/i.test(pathname)
}

function isFacebookHomePath(pathname: string): boolean {
  return pathname === '/' ||
    /^\/(?:home\.php|feed|watch|reels?)(?:\/|$)/i.test(pathname) ||
    /^\/groups\/feed(?:\/|$)/i.test(pathname)
}

function unwrapRedirect(rawUrl: string): string | null {
  let current = rawUrl

  for (let depth = 0; depth < MAX_REDIRECT_DEPTH; depth += 1) {
    let parsed: URL
    try {
      parsed = new URL(current)
    } catch {
      return null
    }

    if (parsed.protocol !== 'https:' || !REDIRECT_HOSTS.has(parsed.hostname.toLowerCase())) {
      return parsed.toString()
    }

    const target = REDIRECT_PARAMETERS
      .map(parameter => parsed.searchParams.get(parameter))
      .find(value => value !== null && value.length > 0)

    if (!target) return null
    current = target
  }

  return null
}

export function isMessengerContentUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' &&
      (url.hostname === 'facebook.com' || url.hostname === 'www.facebook.com') &&
      isMessengerPath(url.pathname)
  } catch {
    return false
  }
}

export function isMessengerAuthenticationUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' &&
      FACEBOOK_AUTH_HOSTS.has(url.hostname.toLowerCase()) &&
      isAuthenticationPath(url.pathname)
  } catch {
    return false
  }
}

export function classifyMessengerNavigation(
  rawUrl: string,
  allowAuthenticationLanding = false,
): MessengerNavigationDecision {
  const resolvedUrl = unwrapRedirect(rawUrl)
  if (!resolvedUrl) return { kind: 'block', url: rawUrl }

  let url: URL
  try {
    url = new URL(resolvedUrl)
  } catch {
    return { kind: 'block', url: rawUrl }
  }

  if (url.username || url.password) return { kind: 'block', url: resolvedUrl }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'block', url: resolvedUrl }
  }
  if (url.protocol !== 'https:') return { kind: 'external', url: url.toString() }

  const hostname = url.hostname.toLowerCase()
  if (isFacebookHost(hostname)) {
    if ((hostname === 'facebook.com' || hostname === 'www.facebook.com') &&
        isMessengerPath(url.pathname)) {
      return { kind: 'allow', url: url.toString() }
    }

    if (FACEBOOK_AUTH_HOSTS.has(hostname) && isAuthenticationPath(url.pathname)) {
      return { kind: 'allow', url: url.toString() }
    }

    if (isFacebookHomePath(url.pathname)) {
      return { kind: 'block', url: url.toString() }
    }
  }

  return { kind: 'external', url: url.toString() }
}
