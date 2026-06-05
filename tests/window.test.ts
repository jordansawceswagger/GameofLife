import { describe, it, expect, vi } from 'vitest'

// window.ts imports electron at module load; stub it so the pure helper imports cleanly.
vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

import { computePopoverPosition, POPOVER_WIDTH, POPOVER_HEIGHT } from '../src/main/window'

const win = { width: POPOVER_WIDTH, height: POPOVER_HEIGHT }

describe('computePopoverPosition', () => {
  it('centers the popover horizontally under the tray and drops below the bar', () => {
    const pos = computePopoverPosition({ x: 1200, y: 0, width: 22, height: 22 }, win)
    // center = 1200 + 11; x = center - width/2
    expect(pos.x).toBe(Math.round(1211 - POPOVER_WIDTH / 2))
    expect(pos.y).toBe(0 + 22 + 4)
  })

  it('clamps to the left margin when the math would push it off-screen left', () => {
    const pos = computePopoverPosition({ x: 100, y: 0, width: 22, height: 22 }, win, {
      screenWidth: 1440,
    })
    expect(pos.x).toBe(8)
  })

  it('clamps to the right margin when the tray sits at the far right', () => {
    const pos = computePopoverPosition({ x: 1430, y: 0, width: 22, height: 22 }, win, {
      screenWidth: 1440,
    })
    expect(pos.x).toBe(1440 - POPOVER_WIDTH - 8)
  })

  it('respects a custom gap', () => {
    const pos = computePopoverPosition({ x: 0, y: 0, width: 22, height: 22 }, win, { gap: 10 })
    expect(pos.y).toBe(32)
  })

  it('exposes sane default dimensions', () => {
    expect(POPOVER_WIDTH).toBeGreaterThan(0)
    expect(POPOVER_HEIGHT).toBeGreaterThan(0)
  })
})
