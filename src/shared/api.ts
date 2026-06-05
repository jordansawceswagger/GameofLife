import type { ViewName } from './views'

/**
 * The typed surface exposed to the renderer as `window.gol` via the preload
 * contextBridge. Step 3 ships only navigation; Step 4 expands this with the file,
 * Claude, and CRM methods. Keep this the single source of truth for the bridge
 * shape so main, preload, and renderer never drift.
 */
export interface GolApi {
  /** Subscribe to hotkey-driven navigation events. Returns an unsubscribe fn. */
  onNavigate: (cb: (view: ViewName) => void) => () => void
}
