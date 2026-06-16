import { globalShortcut } from 'electron'
import type { ViewName } from '../shared/views'

/**
 * The seven global accelerators and the view each one opens.
 *
 * Note on `=`: the user-facing hotkey is ⌃⌘+ on the key labeled `+/=`, but the
 * literal `+` character requires Shift on US Mac keyboards. Registering `=`
 * (the unshifted character on the same physical key) means the user presses
 * the key without holding Shift, which matches what `-` does and keeps the
 * scheme symmetric: `=` for add, `-` for strike, both unshifted.
 */
export const HOTKEY_MAP: Record<string, ViewName> = {
  'Control+Command+Up': 'morning-intake',
  'Control+Command+Down': 'done',
  'Control+Command+Left': 'pause',
  'Control+Command+Right': 'playbook',
  'Control+Command+=': 'add-to-queue',
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
