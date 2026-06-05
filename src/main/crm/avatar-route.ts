import type { Avatar } from './types'

// Parses the legacy `[AVATAR-ROUTE ...]` tag that the research pipeline embeds in
// the SOURCE notes field. This runs ONCE at import to lift fraud_history and
// primary_route into real fields. It is never parsed back into state afterwards.
//
// Format (one line, fields separated by ` | `):
//   [AVATAR-ROUTE 2026-06-01] AVATAR: B | FRAUD_HISTORY: [a, b, c] | ... |
//   PRIMARY_ROUTE: B-DaVita-style | ROUTE_REASON: free text with, commas

export interface AvatarRouteParsed {
  avatar: Avatar
  fraud_history: string[]
  primary_route: string
}

const EMPTY: AvatarRouteParsed = { avatar: null, fraud_history: [], primary_route: '' }

function field(tag: string, name: string): string | null {
  // Capture up to the next ` | ` field delimiter (or end of the tag line).
  const m = new RegExp(`${name}\\s*:\\s*([^|]*)`).exec(tag)
  return m ? m[1].trim() : null
}

function parseAvatarValue(value: string | null): Avatar {
  if (!value) return null
  const v = value.trim().toUpperCase()
  if (v === 'A') return 'A'
  if (v === 'B') return 'B'
  if (v === 'A+B' || v === 'AB' || v === 'A&B') return 'A+B'
  return null // unknown / C-pharma-park / malformed => null
}

function parseList(value: string | null): string[] {
  if (!value) return []
  const inner = value.replace(/^\[/, '').replace(/\]$/, '').trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseAvatarRoute(notes: string): AvatarRouteParsed {
  if (!notes) return { ...EMPTY }
  // Use the LAST tag if there are multiple (latest wins).
  const idx = notes.lastIndexOf('[AVATAR-ROUTE')
  if (idx === -1) return { ...EMPTY }

  let tag = notes.slice(idx)
  const nl = tag.indexOf('\n')
  if (nl !== -1) tag = tag.slice(0, nl)

  return {
    avatar: parseAvatarValue(field(tag, 'AVATAR')),
    fraud_history: parseList(field(tag, 'FRAUD_HISTORY')),
    primary_route: (field(tag, 'PRIMARY_ROUTE') ?? '').trim(),
  }
}

/** Derive the numeric tier from the legacy "TIER 1" prose marker in notes. */
export function parseTier(notes: string): number {
  const m = /TIER\s*(\d+)/i.exec(notes ?? '')
  return m ? Number(m[1]) : 0
}
