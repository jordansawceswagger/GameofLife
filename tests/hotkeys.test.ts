import { describe, it, expect, vi, beforeEach } from 'vitest'

const { registerMock, unregisterAllMock } = vi.hoisted(() => ({
  registerMock: vi.fn((_accelerator: string, _cb: () => void) => true),
  unregisterAllMock: vi.fn(),
}))

vi.mock('electron', () => ({
  globalShortcut: { register: registerMock, unregisterAll: unregisterAllMock },
}))

import { registerHotkeys, unregisterHotkeys, HOTKEY_MAP } from '../src/main/hotkeys'
import { VIEW_NAMES } from '../src/shared/views'

const EXPECTED_ACCELERATORS = [
  'Control+Command+Up',
  'Control+Command+Down',
  'Control+Command+Left',
  'Control+Command+Right',
  'Control+Command+=',
  'Control+Command+-',
  'Control+Command+C',
]

describe('hotkeys', () => {
  beforeEach(() => {
    registerMock.mockReturnValue(true)
  })

  it('registers all 7 accelerators with the exact expected strings', () => {
    const registered = registerHotkeys(vi.fn())
    const accelerators = registerMock.mock.calls.map((c) => c[0])
    expect(accelerators).toHaveLength(7)
    expect(accelerators).toEqual(expect.arrayContaining(EXPECTED_ACCELERATORS))
    expect(registered).toHaveLength(7)
  })

  it('maps exactly the 7 canonical views (no gaps, no extras)', () => {
    expect(Object.values(HOTKEY_MAP).sort()).toEqual([...VIEW_NAMES].sort())
  })

  it('each accelerator handler fires onTrigger with its mapped view', () => {
    const onTrigger = vi.fn()
    registerHotkeys(onTrigger)
    for (const [accelerator, view] of Object.entries(HOTKEY_MAP)) {
      const call = registerMock.mock.calls.find((c) => c[0] === accelerator)
      expect(call, `no register call for ${accelerator}`).toBeTruthy()
      ;(call![1] as () => void)()
      expect(onTrigger).toHaveBeenLastCalledWith(view)
    }
  })

  it('skips accelerators that fail to register and reports the rest', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerMock.mockReturnValueOnce(false) // first one conflicts
    const registered = registerHotkeys(vi.fn())
    expect(registered).toHaveLength(6)
    expect(errSpy).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('unregisterHotkeys clears every shortcut', () => {
    unregisterHotkeys()
    expect(unregisterAllMock).toHaveBeenCalledTimes(1)
  })
})
