import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { makeTempCrm, FIXTURES, type TempCrm } from './helpers'
import {
  crmRebuildMaterialized,
  crmMutate,
  crmAppendHistory,
  crmCycleStatus,
  crmCycleAvatar,
} from '../../src/main/crm/store'
import { todayISODate } from '../../src/main/crm/time'
import type { CrmStore } from '../../src/main/crm/types'

let temp: TempCrm
const ID = 't_seed_pc_1'

beforeEach(async () => {
  temp = await makeTempCrm()
  await copyFile(path.join(FIXTURES, 'crm-live-sample.json'), temp.crmFile)
})
afterEach(async () => {
  await temp.cleanup()
})

describe('crmRebuildMaterialized (repair)', () => {
  it('replays history to recompute status, avatar, and lastTouch after drift', async () => {
    await crmCycleStatus(ID) // -> request_sent
    await crmCycleStatus(ID) // -> connected
    await crmCycleAvatar(ID) // -> A

    // Corrupt the materialized fields directly on disk.
    const store = JSON.parse(await readFile(temp.crmFile, 'utf8')) as CrmStore
    const c = store.contacts.find((x) => x.id === ID)!
    c.status = 'research'
    c.avatar = null
    c.lastTouch = '1999-01-01'
    await writeFile(temp.crmFile, JSON.stringify(store), 'utf8')

    const fixed = await crmRebuildMaterialized(ID)
    expect(fixed.status).toBe('connected')
    expect(fixed.avatar).toBe('A')
    expect(fixed.lastTouch).toBe(todayISODate())
  })

  it('picks lastTouch by chronological epoch, not lexicographic string order, across offsets', async () => {
    const base = JSON.parse(await readFile(temp.crmFile, 'utf8')) as CrmStore
    const contact = {
      ...base.contacts[0],
      id: 't_tz_1',
      history: [
        // 2026-06-06T01:00:00Z (lexicographically the larger string)
        { ts: '2026-06-06T01:00:00+00:00', kind: 'note', detail: 'a', from: null, to: null },
        // 2026-06-05T23:30:00-07:00 == 2026-06-06T06:30:00Z (the actual latest instant)
        { ts: '2026-06-05T23:30:00-07:00', kind: 'note', detail: 'b', from: null, to: null },
      ],
    }
    await writeFile(temp.crmFile, JSON.stringify({ lastImport: null, contacts: [contact] }), 'utf8')

    const fixed = await crmRebuildMaterialized('t_tz_1')
    // The later instant is the -07:00 entry, whose local date is 2026-06-05.
    expect(fixed.lastTouch).toBe('2026-06-05')
  })
})

describe('crmMutate / crmAppendHistory generics', () => {
  it('crmMutate sets a whitelisted STATE field', async () => {
    const c = await crmMutate(ID, 'notes', 'hello world')
    expect(c.notes).toBe('hello world')
  })

  it('crmMutate rejects SOURCE and unknown fields', async () => {
    await expect(crmMutate(ID, 'firm', 'CLOBBER')).rejects.toThrow(/not mutable/)
    await expect(crmMutate(ID, 'id', 'x')).rejects.toThrow(/not mutable/)
    await expect(crmMutate(ID, 'bogusField', 1)).rejects.toThrow(/not mutable/)
  })

  it('crmAppendHistory appends an arbitrary kind with detail and from/to', async () => {
    const c = await crmAppendHistory(ID, 'outreach_sent', 'LinkedIn DM sent', null, null)
    const h = c.history[c.history.length - 1]
    expect(h.kind).toBe('outreach_sent')
    expect(h.detail).toBe('LinkedIn DM sent')
    expect(c.lastTouch).toBe(todayISODate())
  })
})
