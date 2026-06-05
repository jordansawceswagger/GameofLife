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
