import { describe, it, expect, vi } from 'vitest'
import type { GolApi } from '../src/shared/api'

const { exposeMock, ipcRendererMock } = vi.hoisted(() => ({
  exposeMock: vi.fn(),
  ipcRendererMock: {
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined),
  },
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: exposeMock },
  ipcRenderer: ipcRendererMock,
}))

// Importing the preload module runs exposeInMainWorld('gol', api) exactly once,
// at load time. clearMocks (vitest.config) wipes call history before each test, so
// capture the expose facts now, before the first beforeEach clear.
import '../src/preload/index'

const EXPOSE_CALL_COUNT = exposeMock.mock.calls.length
const EXPOSE_KEY = exposeMock.mock.calls[0]?.[0]
const EXPOSED_API = exposeMock.mock.calls[0]?.[1] as Record<string, unknown>

const EXPECTED_METHODS = [
  'onNavigate',
  'readFile',
  'writeFile',
  'runClaudeCode',
  'getDailyNote',
  'rollMovementCard',
  'crmList',
  'crmGet',
  'crmAppendHistory',
  'crmMutate',
  'crmImport',
]

const apiAsGol = EXPOSED_API as unknown as GolApi

describe('preload bridge', () => {
  it('exposes the bridge once under the key "gol"', () => {
    expect(EXPOSE_CALL_COUNT).toBe(1)
    expect(EXPOSE_KEY).toBe('gol')
  })

  it('exposes exactly the expected methods, all functions', () => {
    for (const method of EXPECTED_METHODS) {
      expect(typeof EXPOSED_API[method], `missing or non-function: ${method}`).toBe('function')
    }
    expect(Object.keys(EXPOSED_API).sort()).toEqual([...EXPECTED_METHODS].sort())
  })

  it('readFile forwards to ipcRenderer.invoke on the right channel and returns its result', async () => {
    ipcRendererMock.invoke.mockResolvedValueOnce('file-body')
    const result = await apiAsGol.readFile('/vault/x.md')
    expect(ipcRendererMock.invoke).toHaveBeenCalledWith('gol:readFile', '/vault/x.md')
    expect(result).toBe('file-body')
  })

  it('writeFile forwards path and content', async () => {
    await apiAsGol.writeFile('/vault/x.md', 'hello')
    expect(ipcRendererMock.invoke).toHaveBeenCalledWith('gol:writeFile', '/vault/x.md', 'hello')
  })

  it('crmAppendHistory defaults optional from/to to null', async () => {
    await apiAsGol.crmAppendHistory('t_seed_pc_1', 'note', 'a note')
    expect(ipcRendererMock.invoke).toHaveBeenCalledWith(
      'gol:crmAppendHistory',
      't_seed_pc_1',
      'note',
      'a note',
      null,
      null,
    )
  })

  it('onNavigate subscribes and returns an unsubscribe that removes the listener', () => {
    const off = apiAsGol.onNavigate(() => {})
    expect(ipcRendererMock.on).toHaveBeenCalledWith('gol:navigate', expect.any(Function))
    off()
    expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('gol:navigate', expect.any(Function))
  })
})
