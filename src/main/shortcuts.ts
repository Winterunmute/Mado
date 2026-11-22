export type ShortcutAction =
  | 'open-feed'
  | 'open-sources'
  | 'open-settings'
  | 'refresh-feed'
  | 'toggle-messenger'
  | 'focus-search'
  | 'back-from-reader'

export interface ShortcutInput {
  type?: string
  key?: string
  control?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export function actionForInput(input: ShortcutInput): ShortcutAction | null {
  if (input.type !== undefined && input.type !== 'keyDown') return null
  const key = (input.key || '').toLowerCase()
  const ctrl = input.control === true
  const shift = input.shift === true
  if (input.alt === true || input.meta === true) return null

  if (key === 'escape' && !ctrl && !shift) return 'back-from-reader'
  if (!ctrl) return null

  if (!shift) {
    if (key === '1') return 'open-feed'
    if (key === '2') return 'open-sources'
    if (key === '3') return 'open-settings'
    if (key === 'r') return 'refresh-feed'
    return null
  }

  if (key === 'm') return 'toggle-messenger'
  if (key === 'f') return 'focus-search'
  return null
}

export const SHORTCUT_HELP: { keys: string; action: string }[] = [
  { keys: 'Ctrl+1', action: 'Open Feed' },
  { keys: 'Ctrl+2', action: 'Open Sources' },
  { keys: 'Ctrl+3', action: 'Open Settings' },
  { keys: 'Ctrl+R', action: 'Refresh RSS feed' },
  { keys: 'Ctrl+Shift+M', action: 'Show / hide Messenger' },
  { keys: 'Ctrl+Shift+F', action: 'Focus feed search' },
  { keys: 'Esc', action: 'Return from article reader to Feed' },
]
