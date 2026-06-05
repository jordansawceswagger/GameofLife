import { BrowserWindow } from 'electron'
import path from 'node:path'

export interface TrayBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WinSize {
  width: number
  height: number
}

export const POPOVER_WIDTH = 380
export const POPOVER_HEIGHT = 540

/**
 * Pure positioning math (no Electron), so it can be unit-tested directly.
 * Centers the popover horizontally under the tray and drops it just below the
 * menu bar. When `screenWidth` is supplied, the x is clamped to an 8px margin so
 * the popover never runs off-screen.
 */
export function computePopoverPosition(
  tray: TrayBounds,
  win: WinSize,
  opts?: { gap?: number; screenWidth?: number },
): { x: number; y: number } {
  const gap = opts?.gap ?? 4
  let x = Math.round(tray.x + tray.width / 2 - win.width / 2)
  if (opts?.screenWidth != null) {
    const maxX = opts.screenWidth - win.width - 8
    x = Math.max(8, Math.min(x, maxX))
  }
  const y = Math.round(tray.y + tray.height + gap)
  return { x, y }
}

export function createPopoverWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'))
  }

  // Dismiss on blur (classic menu-bar popover behavior), but stay open while
  // devtools are focused so debugging is possible.
  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) win.hide()
  })

  return win
}

export function showPopover(win: BrowserWindow, trayBounds: TrayBounds): void {
  const { x, y } = computePopoverPosition(trayBounds, win.getBounds())
  win.setPosition(x, y, false)
  win.show()
  win.focus()
}

export function togglePopover(win: BrowserWindow, trayBounds: TrayBounds): void {
  if (win.isVisible()) {
    win.hide()
    return
  }
  showPopover(win, trayBounds)
}
