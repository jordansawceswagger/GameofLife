// Locked CRM schema types. Mirrors 20_Delilah/Reference/CRM Schema (Live).md.
// SOURCE fields are refreshed on import and never edited by the app. STATE fields
// are app-owned and never touched by import.

export const LINEAR_STATUSES = [
  'research',
  'request_sent',
  'connected',
  'dm_sent',
  'in_conversation',
] as const

export const TERMINAL_STATUSES = ['won', 'lost', 'parked'] as const

export const ALL_STATUSES = [...LINEAR_STATUSES, ...TERMINAL_STATUSES] as const

export type LinearStatus = (typeof LINEAR_STATUSES)[number]
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number]
export type Status = (typeof ALL_STATUSES)[number]

export const HISTORY_KINDS = [
  'sourced',
  'status_change',
  'note',
  'avatar_change',
  'matched_sample',
  'outreach_sent',
  'connection_accepted',
  'reply_received',
  'flag',
  'source_removed',
] as const
export type HistoryKind = (typeof HISTORY_KINDS)[number]

export interface HistoryEntry {
  /** FULL ISO 8601 with time and offset, e.g. "2026-06-05T09:14:03-07:00". */
  ts: string
  kind: HistoryKind
  detail: string
  from: string | null
  to: string | null
}

export type Avatar = 'A' | 'B' | 'A+B' | null
export type MatchedSample = 'logan' | 'davita' | null

export interface CrmContact {
  // SOURCE fields (read-only post-import)
  id: string
  name: string
  firm: string
  title: string
  jurisdiction: string
  tier: number
  recentCase: string
  fraud_history: string[]
  primary_route: string
  linkedinUrl: string
  email: string

  // STATE fields (app-owned)
  status: Status
  avatar: Avatar
  matchedSample: MatchedSample
  doNotContact: boolean
  dncReason: string
  accepted: boolean
  replied: boolean
  followedUp: boolean
  /** ISO date (YYYY-MM-DD). */
  lastTouch: string
  /** Genuinely free prose, no structured tags. */
  notes: string
  history: HistoryEntry[]
}

/** The on-disk shape of ~/GameOfLife/crm/crm.json. */
export interface CrmStore {
  contacts: CrmContact[]
  /** FULL ISO 8601 timestamp of the last import run, or null before first import. */
  lastImport: string | null
}

export interface CrmImportResult {
  added: number
  refreshed: number
  removed: number
}
