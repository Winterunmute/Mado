export const MIN_WINDOW_WIDTH = 1000
export const MIN_WINDOW_HEIGHT = 700
export const DEFAULT_WINDOW_WIDTH = 1400
export const DEFAULT_WINDOW_HEIGHT = 900
const MAX_WINDOW_WIDTH = 4096
const MAX_WINDOW_HEIGHT = 2160

export interface WindowState {
  x: number | null
  y: number | null
  width: number
  height: number
  maximized: boolean
}

export interface DisplayArea {
  id: number
  workArea: { x: number; y: number; width: number; height: number }
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  x: null,
  y: null,
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
  maximized: false,
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

export function sanitizeWindowState(value: unknown): WindowState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_WINDOW_STATE }
  const state = value as Record<string, unknown>
  return {
    x: numberOrNull(state.x),
    y: numberOrNull(state.y),
    width: Math.min(MAX_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, numberOrNull(state.width) ?? DEFAULT_WINDOW_WIDTH)),
    height: Math.min(MAX_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, numberOrNull(state.height) ?? DEFAULT_WINDOW_HEIGHT)),
    maximized: state.maximized === true,
  }
}

export function visibleFraction(
  bounds: { x: number; y: number; width: number; height: number },
  workArea: { x: number; y: number; width: number; height: number },
): number {
  const area = Math.max(1, bounds.width * bounds.height)
  const left = Math.max(bounds.x, workArea.x)
  const top = Math.max(bounds.y, workArea.y)
  const right = Math.min(bounds.x + bounds.width, workArea.x + workArea.width)
  const bottom = Math.min(bounds.y + bounds.height, workArea.y + workArea.height)
  if (right <= left || bottom <= top) return 0
  return ((right - left) * (bottom - top)) / area
}

export function isMostlyVisible(
  bounds: { x: number; y: number; width: number; height: number },
  workArea: { x: number; y: number; width: number; height: number },
): boolean {
  return visibleFraction(bounds, workArea) >= 0.6
}

export function centerOnDisplay(
  width: number,
  height: number,
  workArea: { x: number; y: number; width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const safeWidth = Math.max(MIN_WINDOW_WIDTH, Math.min(width, Math.max(MIN_WINDOW_WIDTH, workArea.width)))
  const safeHeight = Math.max(MIN_WINDOW_HEIGHT, Math.min(height, Math.max(MIN_WINDOW_HEIGHT, workArea.height)))
  return {
    x: Math.round(workArea.x + Math.max(0, (workArea.width - safeWidth) / 2)),
    y: Math.round(workArea.y + Math.max(0, (workArea.height - safeHeight) / 2)),
    width: safeWidth,
    height: safeHeight,
  }
}

export function resolveWindowBounds(
  state: WindowState,
  displays: DisplayArea[],
  primaryId: number,
): { x: number; y: number; width: number; height: number } {
  const safe = sanitizeWindowState(state)
  const primary = displays.find(display => display.id === primaryId) ?? displays[0]

  if (safe.x !== null && safe.y !== null) {
    const candidate = { x: safe.x, y: safe.y, width: safe.width, height: safe.height }
    const visibleDisplay = displays.find(display => isMostlyVisible(candidate, display.workArea))
    if (visibleDisplay) return candidate
  }

  if (!primary) {
    return { x: safe.x ?? 0, y: safe.y ?? 0, width: safe.width, height: safe.height }
  }
  return centerOnDisplay(safe.width, safe.height, primary.workArea)
}

export function stateFromBounds(
  bounds: { x: number; y: number; width: number; height: number },
  maximized: boolean,
): WindowState {
  return sanitizeWindowState({ ...bounds, maximized })
}
