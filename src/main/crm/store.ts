import { loadStore, persistStore, ensureStore } from './persistence'
import { nowISO, todayISODate } from './time'
import { LINEAR_STATUSES } from './types'
import type {
  CrmContact,
  HistoryEntry,
  HistoryKind,
  Status,
  LinearStatus,
  TerminalStatus,
  Avatar,
  MatchedSample,
} from './types'

export class CrmContactNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`CRM contact not found: ${id}`)
    this.name = 'CrmContactNotFoundError'
  }
}

export async function crmList(): Promise<CrmContact[]> {
  return (await loadStore()).contacts
}

export async function crmGet(id: string): Promise<CrmContact | null> {
  return (await loadStore()).contacts.find((c) => c.id === id) ?? null
}

function pushHistory(
  c: CrmContact,
  kind: HistoryKind,
  detail: string,
  from: string | null = null,
  to: string | null = null,
): void {
  const entry: HistoryEntry = { ts: nowISO(), kind, detail, from, to }
  c.history.push(entry)
}

/**
 * Read store, apply a mutation to one contact (which updates the materialized
 * field AND appends history), bump lastTouch to today, persist atomically.
 */
async function mutate(id: string, apply: (c: CrmContact) => void): Promise<CrmContact> {
  await ensureStore()
  const store = await loadStore()
  const contact = store.contacts.find((c) => c.id === id)
  if (!contact) throw new CrmContactNotFoundError(id)
  apply(contact)
  contact.lastTouch = todayISODate()
  await persistStore(store)
  return contact
}

/** Append free prose: updates top-level notes AND logs a note history entry. */
export function crmAddNote(id: string, prose: string): Promise<CrmContact> {
  return mutate(id, (c) => {
    c.notes = c.notes ? `${c.notes}\n${prose}` : prose
    pushHistory(c, 'note', prose)
  })
}

/**
 * Advance the linear funnel one step; wrap from in_conversation back to research.
 * Terminal states (won/lost/parked) are a no-op: the S-key never moves them. They
 * stay terminal until crmSetTerminal (or crmResetToLinear) is called.
 */
export async function crmCycleStatus(id: string): Promise<CrmContact> {
  const current = await crmGet(id)
  if (!current) throw new CrmContactNotFoundError(id)
  const idx = LINEAR_STATUSES.indexOf(current.status as LinearStatus)
  if (idx === -1) {
    return current // terminal: no-op, no write, no lastTouch change
  }
  return mutate(id, (c) => {
    const from = c.status
    const to = LINEAR_STATUSES[(idx + 1) % LINEAR_STATUSES.length]
    c.status = to
    pushHistory(c, 'status_change', `status ${from} -> ${to}`, from, to)
  })
}

/** Deliberate terminal-state setter. Requires a detail (the reason). */
export function crmSetTerminal(
  id: string,
  terminalStatus: TerminalStatus,
  detail: string,
): Promise<CrmContact> {
  if (!detail || !detail.trim()) {
    return Promise.reject(new Error('crmSetTerminal requires a non-empty detail'))
  }
  return mutate(id, (c) => {
    const from = c.status
    c.status = terminalStatus
    pushHistory(c, 'status_change', detail, from, terminalStatus)
  })
}

/** Explicit escape from a terminal state back to the start of the linear funnel. */
export function crmResetToLinear(id: string): Promise<CrmContact> {
  return mutate(id, (c) => {
    const from = c.status
    const to: Status = 'research'
    c.status = to
    pushHistory(c, 'status_change', 'reset to linear funnel', from, to)
  })
}

const AVATAR_CYCLE: Avatar[] = [null, 'A', 'B', 'A+B']

/** Cycle null -> A -> B -> A+B -> null. */
export function crmCycleAvatar(id: string): Promise<CrmContact> {
  return mutate(id, (c) => {
    const idx = AVATAR_CYCLE.findIndex((a) => a === c.avatar)
    const from = c.avatar
    const to = AVATAR_CYCLE[(idx + 1) % AVATAR_CYCLE.length]
    c.avatar = to
    pushHistory(c, 'avatar_change', `avatar ${String(from)} -> ${String(to)}`, from, to)
  })
}

export function crmSetMatchedSample(id: string, sample: MatchedSample): Promise<CrmContact> {
  return mutate(id, (c) => {
    const from = c.matchedSample
    c.matchedSample = sample
    pushHistory(c, 'matched_sample', `matchedSample ${String(from)} -> ${String(sample)}`, from, sample)
  })
}

export function crmSetDNC(id: string, reason: string): Promise<CrmContact> {
  return mutate(id, (c) => {
    c.doNotContact = true
    c.dncReason = reason
    pushHistory(c, 'flag', `do-not-contact: ${reason}`)
  })
}

export function crmFlagAccepted(id: string): Promise<CrmContact> {
  return mutate(id, (c) => {
    c.accepted = true
    pushHistory(c, 'connection_accepted', 'connection accepted')
  })
}

export function crmFlagReplied(id: string): Promise<CrmContact> {
  return mutate(id, (c) => {
    c.replied = true
    pushHistory(c, 'reply_received', 'reply received')
  })
}

export function crmFlagFollowedUp(id: string): Promise<CrmContact> {
  return mutate(id, (c) => {
    c.followedUp = true
    pushHistory(c, 'note', 'follow-up sent')
  })
}

/** Generic history append (the bridge's crmAppendHistory entry point). */
export function crmAppendHistory(
  id: string,
  kind: HistoryKind,
  detail: string,
  from: string | null = null,
  to: string | null = null,
): Promise<CrmContact> {
  return mutate(id, (c) => pushHistory(c, kind, detail, from, to))
}

// STATE fields the generic crmMutate is allowed to set. SOURCE fields are
// import-owned and never writable through the bridge.
const MUTABLE_FIELDS = new Set<keyof CrmContact>([
  'status',
  'avatar',
  'matchedSample',
  'doNotContact',
  'dncReason',
  'accepted',
  'replied',
  'followedUp',
  'notes',
])

/** Generic field setter (bridge escape hatch). Prefer the semantic mutators. */
export function crmMutate(id: string, field: string, value: unknown): Promise<CrmContact> {
  if (!MUTABLE_FIELDS.has(field as keyof CrmContact)) {
    return Promise.reject(new Error(`crmMutate: field not mutable: ${field}`))
  }
  return mutate(id, (c) => {
    const record = c as unknown as Record<string, unknown>
    const from = record[field]
    record[field] = value
    pushHistory(
      c,
      'note',
      `${field} set`,
      from == null ? null : String(from),
      value == null ? null : String(value),
    )
  })
}

/**
 * Repair: replay history to recompute materialized status/avatar/lastTouch. Used
 * only when fields are suspected to have drifted. Not called automatically and
 * does not append history.
 */
export async function crmRebuildMaterialized(id: string): Promise<CrmContact> {
  await ensureStore()
  const store = await loadStore()
  const contact = store.contacts.find((c) => c.id === id)
  if (!contact) throw new CrmContactNotFoundError(id)

  let status: Status = 'research'
  let avatar: Avatar = null
  let lastTs: string | null = null
  let lastMs = -Infinity
  for (const h of contact.history) {
    // status/avatar follow append order (chronological intent).
    if (h.kind === 'status_change' && h.to) status = h.to as Status
    else if (h.kind === 'avatar_change') avatar = (h.to as Avatar) ?? null
    // lastTouch picks the chronologically latest ts by epoch, not by string order
    // (ISO strings with differing UTC offsets do not sort chronologically).
    const ms = Date.parse(h.ts)
    if (Number.isFinite(ms) && ms >= lastMs) {
      lastMs = ms
      lastTs = h.ts
    }
  }
  contact.status = status
  contact.avatar = avatar
  if (lastTs) contact.lastTouch = lastTs.slice(0, 10)

  await persistStore(store)
  return contact
}
