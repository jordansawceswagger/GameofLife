import { existsSync } from 'node:fs'
import { ensureStore, loadStore, persistStore } from './persistence'
import { readJSON } from './atomic'
import { crmSourcePath } from './paths'
import { parseAvatarRoute, parseTier } from './avatar-route'
import { nowISO, todayISODate } from './time'
import type { CrmContact, CrmStore, CrmImportResult, HistoryEntry } from './types'

interface SourceRecord {
  id: string
  name?: string
  firm?: string
  title?: string
  jurisdiction?: string
  linkedinUrl?: string
  email?: string
  recentCase?: string
  notes?: string
}

interface SourceRoster {
  targets?: SourceRecord[]
}

// The SOURCE fields the import owns. Refreshed on every import; STATE is never touched.
function sourceFieldsOf(src: SourceRecord): Pick<
  CrmContact,
  | 'name'
  | 'firm'
  | 'title'
  | 'jurisdiction'
  | 'tier'
  | 'recentCase'
  | 'fraud_history'
  | 'primary_route'
  | 'linkedinUrl'
  | 'email'
> {
  const route = parseAvatarRoute(src.notes ?? '')
  return {
    name: src.name ?? '',
    firm: src.firm ?? '',
    title: src.title ?? '',
    jurisdiction: src.jurisdiction ?? '',
    tier: parseTier(src.notes ?? ''),
    recentCase: src.recentCase ?? '',
    fraud_history: route.fraud_history,
    primary_route: route.primary_route,
    linkedinUrl: src.linkedinUrl ?? '',
    email: src.email ?? '',
  }
}

/**
 * Import from the SOURCE roster into the LIVE store, keyed by id.
 * - New id: create with SOURCE fields + initialized STATE + one `sourced` entry.
 *   avatar is set to null (operator sets it via the A key); SOURCE notes prose is
 *   NOT copied (it carries AVATAR-ROUTE tags); fraud_history + primary_route ARE
 *   lifted from the AVATAR-ROUTE tag.
 * - Existing id: refresh SOURCE fields only. STATE (incl. lastTouch) is untouched.
 * - Live id missing from source: append a `source_removed` history entry, keep it.
 */
export async function importFromSource(): Promise<CrmImportResult> {
  await ensureStore()
  const sourcePath = crmSourcePath()
  // Explicit guard: a missing roster aborts BEFORE the removal pass, so an absent
  // source file can never mass-flag every live contact as source_removed.
  if (!existsSync(sourcePath)) {
    throw new Error(
      `CRM source roster not found: ${sourcePath}. Import aborted; no contacts were changed.`,
    )
  }
  const roster = await readJSON<SourceRoster>(sourcePath)
  const sources = Array.isArray(roster.targets) ? roster.targets : []

  const store: CrmStore = await loadStore()
  const byId = new Map(store.contacts.map((c) => [c.id, c]))
  const sourceIds = new Set<string>()

  let added = 0
  let refreshed = 0
  let removed = 0

  for (const src of sources) {
    if (!src.id) continue
    sourceIds.add(src.id)
    const fields = sourceFieldsOf(src)
    const existing = byId.get(src.id)

    if (!existing) {
      const sourced: HistoryEntry = {
        ts: nowISO(),
        kind: 'sourced',
        detail: 'Imported from research roster',
        from: null,
        to: null,
      }
      store.contacts.push({
        id: src.id,
        ...fields,
        status: 'research',
        avatar: null,
        matchedSample: null,
        doNotContact: false,
        dncReason: '',
        accepted: false,
        replied: false,
        followedUp: false,
        lastTouch: todayISODate(),
        notes: '',
        history: [sourced],
      })
      added++
    } else {
      // Refresh SOURCE fields only. lastTouch is NOT bumped: a source refresh is a
      // system event, not an operator touch.
      Object.assign(existing, fields)
      refreshed++
    }
  }

  for (const contact of store.contacts) {
    if (!sourceIds.has(contact.id)) {
      const alreadyFlagged = contact.history.some((h) => h.kind === 'source_removed')
      if (!alreadyFlagged) {
        contact.history.push({
          ts: nowISO(),
          kind: 'source_removed',
          detail: 'No longer present in source roster',
          from: null,
          to: null,
        })
        removed++
      }
    }
  }

  store.lastImport = nowISO()
  await persistStore(store)
  return { added, refreshed, removed }
}
