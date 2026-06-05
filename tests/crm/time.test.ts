import { describe, it, expect } from 'vitest'
import { todayISODate, nowISO, backupStamp } from '../../src/main/crm/time'

describe('crm time helpers', () => {
  it('todayISODate formats YYYY-MM-DD from local components', () => {
    expect(todayISODate(new Date(2026, 5, 5, 9, 14, 3))).toBe('2026-06-05')
    expect(todayISODate(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01')
  })

  it('nowISO is full ISO 8601 with a timezone offset and round-trips to the same instant', () => {
    const d = new Date(2026, 5, 5, 9, 14, 3)
    const iso = nowISO(d)
    expect(iso).toMatch(/^2026-06-05T09:14:03[+-]\d{2}:\d{2}$/)
    expect(new Date(iso).getTime()).toBe(d.getTime())
  })

  it('backupStamp has no colons and sorts lexicographically by time (incl. ms)', () => {
    const a = backupStamp(new Date(2026, 5, 5, 9, 14, 3, 1))
    const b = backupStamp(new Date(2026, 5, 5, 9, 14, 3, 2))
    const c = backupStamp(new Date(2026, 5, 5, 9, 14, 4, 0))
    expect(a).not.toContain(':')
    expect(a < b).toBe(true)
    expect(b < c).toBe(true)
  })
})
