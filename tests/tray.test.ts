import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted above imports, so the shared mocks must be created via
// vi.hoisted (which also runs first) to avoid a TDZ ReferenceError.
const { TrayMock, trayInstance, MenuMock } = vi.hoisted(() => {
  const trayInstance = {
    setToolTip: vi.fn(),
    on: vi.fn(),
    getBounds: vi.fn(() => ({ x: 1200, y: 0, width: 22, height: 22 })),
    popUpContextMenu: vi.fn(),
  }
  const TrayMock = vi.fn(() => trayInstance)
  const MenuMock = {
    buildFromTemplate: vi.fn((_template: Array<{ label?: string; type?: string }>) => ({
      id: 'menu',
    })),
  }
  return { TrayMock, trayInstance, MenuMock }
})

vi.mock('electron', () => ({
  Tray: TrayMock,
  Menu: MenuMock,
}))

import { createTray, TRAY_ICON_PATH } from '../src/main/tray'

describe('tray', () => {
  beforeEach(() => {
    // clearMocks is on in vitest.config; getBounds keeps its implementation.
    trayInstance.getBounds.mockReturnValue({ x: 1200, y: 0, width: 22, height: 22 })
  })

  it('resolves the template icon path under assets/icons', () => {
    expect(TRAY_ICON_PATH).toMatch(/assets\/icons\/trayTemplate\.png$/)
  })

  it('constructs the Tray with the icon path and sets the tooltip', () => {
    createTray({ onToggle: vi.fn() })
    expect(TrayMock).toHaveBeenCalledTimes(1)
    expect(TrayMock).toHaveBeenCalledWith(expect.stringContaining('assets/icons/trayTemplate.png'))
    expect(trayInstance.setToolTip).toHaveBeenCalledWith('Game of Life')
  })

  it('honors a custom icon path and tooltip', () => {
    createTray({ onToggle: vi.fn(), iconPath: '/tmp/custom.png', tooltip: 'Custom' })
    expect(TrayMock).toHaveBeenCalledWith('/tmp/custom.png')
    expect(trayInstance.setToolTip).toHaveBeenCalledWith('Custom')
  })

  it('opens the popover on left-click by calling onToggle with tray bounds', () => {
    const onToggle = vi.fn()
    createTray({ onToggle })

    const clickCall = trayInstance.on.mock.calls.find((c) => c[0] === 'click')
    expect(clickCall).toBeTruthy()

    // Fire the registered click handler.
    ;(clickCall![1] as () => void)()
    expect(onToggle).toHaveBeenCalledWith({ x: 1200, y: 0, width: 22, height: 22 })
  })

  it('builds a right-click Quit menu only when onQuit is provided', () => {
    const onQuit = vi.fn()
    createTray({ onToggle: vi.fn(), onQuit })
    expect(MenuMock.buildFromTemplate).toHaveBeenCalledTimes(1)
    const template = MenuMock.buildFromTemplate.mock.calls[0][0]
    const labels = template.map((i) => i.label).filter(Boolean)
    expect(labels).toContain('Quit Game of Life')

    const rightClick = trayInstance.on.mock.calls.find((c) => c[0] === 'right-click')
    expect(rightClick).toBeTruthy()
  })
})
