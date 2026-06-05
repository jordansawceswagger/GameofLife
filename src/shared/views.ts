/**
 * The seven views the global hotkeys route to. Shared by the main process
 * (hotkey -> IPC), the preload bridge, and the renderer router so the set stays
 * in lockstep across processes.
 */
export const VIEW_NAMES = [
  'morning-intake',
  'done',
  'pause',
  'playbook',
  'add-to-queue',
  'strike',
  'crm',
] as const

export type ViewName = (typeof VIEW_NAMES)[number]

/** IPC channel main uses to tell the renderer which view to show. */
export const NAVIGATE_CHANNEL = 'gol:navigate'
