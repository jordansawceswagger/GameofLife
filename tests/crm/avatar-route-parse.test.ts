import { describe, it, expect } from 'vitest'
import { parseAvatarRoute, parseTier } from '../../src/main/crm/avatar-route'

describe('parseAvatarRoute', () => {
  it('extracts avatar, fraud_history, and primary_route from a well-formed tag', () => {
    const notes =
      'prose here || [AVATAR-ROUTE 2026-06-01] AVATAR: B | FRAUD_HISTORY: [MA-upcoding, risk-adjustment, dialysis] | CIA_HOOK: yes | PRIMARY_ROUTE: B-DaVita-style | ROUTE_REASON: Kaiser, DaVita, risk-adjustment whale theory.'
    const r = parseAvatarRoute(notes)
    expect(r.avatar).toBe('B')
    expect(r.fraud_history).toEqual(['MA-upcoding', 'risk-adjustment', 'dialysis'])
    expect(r.primary_route).toBe('B-DaVita-style')
  })

  it('returns defaults when the tag is missing', () => {
    expect(parseAvatarRoute('just prose, no tag at all')).toEqual({
      avatar: null,
      fraud_history: [],
      primary_route: '',
    })
  })

  it('treats an unknown avatar value as null', () => {
    const r = parseAvatarRoute(
      '[AVATAR-ROUTE 2026-06-01] AVATAR: C-pharma-park | FRAUD_HISTORY: [x] | PRIMARY_ROUTE: C',
    )
    expect(r.avatar).toBeNull()
    expect(r.fraud_history).toEqual(['x'])
  })

  it('parses the A+B combined avatar', () => {
    const r = parseAvatarRoute(
      '[AVATAR-ROUTE 2026-06-01] AVATAR: A+B | FRAUD_HISTORY: [a, b] | PRIMARY_ROUTE: B-DaVita-style',
    )
    expect(r.avatar).toBe('A+B')
  })

  it('uses the latest tag when multiple are present', () => {
    const notes = [
      '[AVATAR-ROUTE 2026-05-01] AVATAR: A | FRAUD_HISTORY: [old] | PRIMARY_ROUTE: A-Logan-style',
      '[AVATAR-ROUTE 2026-06-01] AVATAR: B | FRAUD_HISTORY: [new] | PRIMARY_ROUTE: B-DaVita-style',
    ].join('\n')
    const r = parseAvatarRoute(notes)
    expect(r.avatar).toBe('B')
    expect(r.fraud_history).toEqual(['new'])
    expect(r.primary_route).toBe('B-DaVita-style')
  })

  it('tolerates a malformed tag with missing fields', () => {
    const r = parseAvatarRoute('[AVATAR-ROUTE 2026-06-01] AVATAR: A')
    expect(r.avatar).toBe('A')
    expect(r.fraud_history).toEqual([])
    expect(r.primary_route).toBe('')
  })

  it('does not let ROUTE_REASON free text poison AVATAR or PRIMARY_ROUTE', () => {
    const notes =
      '[AVATAR-ROUTE 2026-06-01] AVATAR: A | FRAUD_HISTORY: [x] | PRIMARY_ROUTE: A-Logan-style | ROUTE_REASON: we weighed AVATAR: B and PRIMARY_ROUTE: B-DaVita-style but chose A.'
    const r = parseAvatarRoute(notes)
    expect(r.avatar).toBe('A')
    expect(r.primary_route).toBe('A-Logan-style')
  })

  it('captures a FRAUD_HISTORY list even if items are pipe-separated inside the brackets', () => {
    const r = parseAvatarRoute(
      '[AVATAR-ROUTE 2026-06-01] AVATAR: B | FRAUD_HISTORY: [a | b | c] | PRIMARY_ROUTE: B-DaVita-style',
    )
    expect(r.fraud_history).toEqual(['a', 'b', 'c'])
    expect(r.primary_route).toBe('B-DaVita-style')
  })
})

describe('parseTier', () => {
  it('reads the tier number from the legacy TIER marker', () => {
    expect(parseTier('TIER 1 - gold standard')).toBe(1)
    expect(parseTier('TIER 2 SIDECAR')).toBe(2)
    expect(parseTier('no marker present')).toBe(0)
  })

  it('does not match TIER inside another word (frontier, rentier)', () => {
    expect(parseTier('frontier markets outlook 2050')).toBe(0)
    expect(parseTier('a rentier 3 economy')).toBe(0)
  })
})
