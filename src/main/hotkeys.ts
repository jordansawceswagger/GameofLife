import { globalShortcut } from 'electron'
import type { ViewName } from '../shared/views'

/**
 * The seven global accelerators and the view each one opens. `Plus` is spelled
 * out because `+` is the accelerator separator; minus is the literal `-`.
 */
export const HOTKEY_MAP: Record<string, ViewName> = {
  'Control+Command+Up': 'morning-intake',
  'Control+Command+Down': 'done',
  'Control+Command+Left': 'pause',
  'Control+Command+Right': 'playbook',
  'Control+Command+Plus': 'add-to-queue',
  'Control+Command+-': 'strike',
  'Control+Command+C': 'crm',
}

/**
 * Registers every hotkey. Returns the accelerators that registered successfully
 * (the rest are logged as conflicts so a clash is visible, not silent).
 */
export function registerHotkeys(onTrigger: (view: ViewName) => void): string[] {
  const registered: string[] = []
  for (const [accelerator, view] of Object.entries(HOTKEY_MAP)) {
    const ok = globalShortcut.register(accelerator, () => onTrigger(view))
    if (ok) {
      registered.push(accelerator)
    } else {
      console.error(`[hotkeys] failed to register ${accelerator} (conflict?)`)
    }
  }
  return registered
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
