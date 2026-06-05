import { app } from 'electron'
import type { BrowserWindow, Tray } from 'electron'
import { createTray } from './tray'
import { createPopoverWindow, showPopover, togglePopover } from './window'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { registerIpcHandlers } from './ipc'
import { ensureStore } from './crm/persistence'
import { rebuildEntityLinks } from './crm/entity-links'
import { NAVIGATE_CHANNEL, type ViewName } from '../shared/views'

let tray: Tray | null = null
let popover: BrowserWindow | null = null

/** Show the popover under the tray and tell the renderer which view to open. */
function navigateTo(view: ViewName): void {
  if (!popover) return
  if (tray) showPopover(popover, tray.getBounds())
  popover.webContents.send(NAVIGATE_CHANNEL, view)
}

function bootstrap(): void {
  // Menu-bar app: hide the dock icon (macOS only).
  app.dock?.hide()

  registerIpcHandlers()

  // Warm up CRM state: ensure the live store exists and build the entity-link map.
  // Import is NOT auto-run; the operator triggers crmImport explicitly (see DECISIONS).
  void ensureStore()
  void rebuildEntityLinks()

  popover = createPopoverWindow()
  tray = createTray({
    onToggle: (bounds) => {
      if (popover) togglePopover(popover, bounds)
    },
    onQuit: () => app.quit(),
  })

  registerHotkeys(navigateTo)
}

app.whenReady().then(bootstrap)

app.on('will-quit', () => {
  unregisterHotkeys()
})

// On macOS the app stays alive in the tray after the popover is dismissed.

/** Exposed for wiring/inspection; keeps the tray reference reachable. */
export function getTray(): Tray | null {
  return tray
}

/** Exposed so later steps (IPC handlers) can drive the popover. */
export function getPopover(): BrowserWindow | null {
  return popover
}
