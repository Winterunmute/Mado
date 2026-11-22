import { Menu, Tray, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface TrayHandlers {
  iconPath: string
  unreadIconPath: string
  onShow: () => void
  onHide: () => void
  onQuit: () => void
}

let tray: Tray | null = null

function loadIcon(path: string) {
  if (!existsSync(path)) return nativeImage.createEmpty()
  // The ICO contains purpose-built 16/24/32px frames; let Windows pick one
  // instead of resizing the source and losing stroke clarity.
  const image = nativeImage.createFromPath(path)
  return image.isEmpty() ? nativeImage.createEmpty() : image
}

export function isTrayActive(): boolean {
  return tray !== null && !tray.isDestroyed()
}

export function createOrUpdateTray(handlers: TrayHandlers): void {
  if (isTrayActive()) {
    tray!.setContextMenu(buildMenu(handlers))
    return
  }
  tray = new Tray(loadIcon(handlers.iconPath))
  tray.setToolTip('Mado — Your window to the world.')
  tray.setContextMenu(buildMenu(handlers))
  tray.on('double-click', handlers.onShow)
  tray.on('click', () => { /* Windows uses the context menu; double-click restores. */ })
}

function buildMenu(handlers: TrayHandlers): Menu {
  return Menu.buildFromTemplate([
    { label: 'Show Mado', click: handlers.onShow },
    { label: 'Hide Mado', click: handlers.onHide },
    { type: 'separator' },
    { label: 'Quit Mado', click: handlers.onQuit },
  ])
}

export function setTrayUnread(active: boolean, iconPath: string, unreadIconPath: string): void {
  if (!isTrayActive()) return
  tray!.setImage(loadIcon(active ? unreadIconPath : iconPath))
  tray!.setToolTip(active ? 'Mado — Messenger has unread activity' : 'Mado — Your window to the world.')
}

export function destroyTray(): void {
  if (!isTrayActive()) return
  tray!.destroy()
  tray = null
}

export function trayIconPaths(): {
  iconPath: string
  unreadIconPath: string
  smallIconPath: string
  smallUnreadIconPath: string
} {
  const directory = import.meta.dirname
  return {
    iconPath: join(directory, '../assets/icon.png'),
    unreadIconPath: join(directory, '../assets/icon-unread.png'),
    smallIconPath: join(directory, '../assets/icon-small.ico'),
    smallUnreadIconPath: join(directory, '../assets/icon-unread-small.ico'),
  }
}
