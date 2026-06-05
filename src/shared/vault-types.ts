// Types for the vault file layer (parsed daily notes, task queue, movement cards).
// Kept in shared/ so the preload bridge surface can reference them without pulling
// main-process logic into the renderer bundle.

export type MovementTier = 'micro' | 'meso' | 'macro'

export interface DailyNoteFrontmatter {
  date: string
  weekday?: string
  day_state?: string
  top_three?: string[]
  despiral_completed?: boolean
  morning_intake_completed?: boolean
  streak_day?: number
  movement_rolls?: number
  movement_xp?: { micro: number; meso: number; macro: number }
  // The template carries many more keys; keep them addressable without losing types.
  [key: string]: unknown
}

export interface DailyNote {
  date: string
  frontmatter: DailyNoteFrontmatter
  /** Raw markdown body (everything after the frontmatter). */
  body: string
  /** Body text keyed by `##` heading, e.g. sections["Completion Log"]. */
  sections: Record<string, string>
}

export interface TaskQueue {
  now: string[]
  next: string[]
  later: string[]
}

export interface MovementCards {
  micro: string[]
  meso: string[]
  macro: string[]
}

export interface CompletionLogEntry {
  time: string
  task: string
  linked?: string
  tier?: string
  card?: string
  felt?: string
}
