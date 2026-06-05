import { app } from 'electron'
import type { BrowserWindow, Tray } from 'electron'
import { createTray } from './tray'
import { createPopoverWindow, togglePopover } from './window'

let tray: Tray | null = null
let popover: BrowserWindow | null = null

function bootstrap(): void {
  // Menu-bar app: hide the dock icon (macOS only).
  app.dock?.hide()

  popover = createPopoverWindow()
  tray = createTray({
    onToggle: (bounds) => {
      if (popover) togglePopover(popover, bounds)
    },
    onQuit: () => app.quit(),
  })
}

app.whenReady().then(bootstrap)

// On macOS the app stays alive in the tray after the popover is dismissed
// (no window-all-closed quit), which is exactly what a menu-bar app wants.

/** Exposed for wiring/inspection; keeps the tray reference reachable. */
export function getTray(): Tray | null {
  return tray
}

/** Exposed so later steps (hotkeys, IPC) can drive the popover. */
export function getPopover(): BrowserWindow | null {
  return popover
}
