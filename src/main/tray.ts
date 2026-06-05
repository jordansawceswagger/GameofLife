import { Tray, Menu } from 'electron'
import path from 'node:path'

/**
 * Path to the menu-bar template icon. Resolved relative to the built main bundle
 * (dist-electron/main) in production and to src/main during tests; both land on
 * the repo's assets/icons/trayTemplate.png.
 */
export const TRAY_ICON_PATH = path.join(
  __dirname,
  '..',
  '..',
  'assets',
  'icons',
  'trayTemplate.png',
)

export interface TrayBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CreateTrayOptions {
  /** Called on left-click with the tray's current screen bounds. */
  onToggle: (bounds: TrayBounds) => void
  /** Wired into a right-click context menu so a frameless app stays quittable. */
  onQuit?: () => void
  iconPath?: string
  tooltip?: string
}

export function createTray(opts: CreateTrayOptions): Tray {
  const iconPath = opts.iconPath ?? TRAY_ICON_PATH
  const tray = new Tray(iconPath)
  tray.setToolTip(opts.tooltip ?? 'Game of Life')

  tray.on('click', () => {
    opts.onToggle(tray.getBounds())
  })

  if (opts.onQuit) {
    const menu = Menu.buildFromTemplate([
      { label: 'Open Game of Life', click: () => opts.onToggle(tray.getBounds()) },
      { type: 'separator' },
      { label: 'Quit Game of Life', click: opts.onQuit },
    ])
    tray.on('right-click', () => tray.popUpContextMenu(menu))
  }

  return tray
}
