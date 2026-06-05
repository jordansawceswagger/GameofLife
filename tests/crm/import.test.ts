import { describe, it, expect, afterEach } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { makeTempCrm, useSourceFixture, FIXTURES, type TempCrm } from './helpers'
import { importFromSource } from '../../src/main/crm/import'
import { crmList, crmGet, crmCycleStatus } from '../../src/main/crm/store'
import { todayISODate } from '../../src/main/crm/time'
import type { CrmStore } from '../../src/main/crm/types'

let temp: TempCrm
let restoreSource: (() => void) | undefined

afterEach(async () => {
  restoreSource?.()
  restoreSource = undefined
  await temp?.cleanup()
})

async function setup(): Promise<void> {
  temp = await makeTempCrm()
  restoreSource = useSourceFixture()
}

describe('importFromSource', () => {
  it('first import creates all contacts with initialized STATE and a sourced entry', async () => {
    await setup()
    const res = await importFromSource()
    expect(res).toEqual({ added: 3, refreshed: 0, removed: 0 })

    const ids = (await crmList()).map((c) => c.id).sort()
    expect(ids).toEqual(['t_seed_edge_1', 't_seed_mala_1', 't_seed_pc_1'])

    const pc = await crmGet('t_seed_pc_1')
    expect(pc).not.toBeNull()
    // AVATAR-ROUTE lifted into SOURCE fields
    expect(pc!.fraud_history).toEqual(['MA-upcoding', 'risk-adjustment', 'dialysis'])
    expect(pc!.primary_route).toBe('B-DaVita-style')
    expect(pc!.tier).toBe(1)
    // STATE initialized; avatar NOT inherited from the tag
    expect(pc!.status).toBe('research')
    expect(pc!.avatar).toBeNull()
    expect(pc!.matchedSample).toBeNull()
    expect(pc!.doNotContact).toBe(false)
    expect(pc!.notes).toBe('') // SOURCE prose not copied into operator notes
    expect(pc!.lastTouch).toBe(todayISODate())
    expect(pc!.history).toHaveLength(1)
    expect(pc!.history[0].kind).toBe('sourced')

    // edge contact has no tag => empty derived fields, tier 3
    const edge = await crmGet('t_seed_edge_1')
    expect(edge!.fraud_history).toEqual([])
    expect(edge!.primary_route).toBe('')
    expect(edge!.tier).toBe(3)
  })

  it('second import is idempotent: no dupes, SOURCE refreshed, STATE untouched', async () => {
    await setup()
    await importFromSource()
    await crmCycleStatus('t_seed_pc_1') // research -> request_sent (a STATE change)
    expect((await crmGet('t_seed_pc_1'))!.status).toBe('request_sent')

    const res = await importFromSource()
    expect(res.added).toBe(0)
    expect(res.refreshed).toBe(3)
    expect(await crmList()).toHaveLength(3) // no duplicates

    const after = await crmGet('t_seed_pc_1')
    expect(after!.status).toBe('request_sent') // STATE preserved
    expect(after!.history.filter((h) => h.kind === 'sourced')).toHaveLength(1) // no dup sourced
  })

  it('refreshes changed SOURCE fields but never STATE', async () => {
    await setup()
    await importFromSource()
    await crmCycleStatus('t_seed_pc_1')

    // Mutate the live store's SOURCE field to a stale value, then re-import.
    const store = JSON.parse(await readFile(temp.crmFile, 'utf8')) as CrmStore
    const pc = store.contacts.find((c) => c.id === 't_seed_pc_1')!
    pc.firm = 'STALE FIRM'
    await writeFile(temp.crmFile, JSON.stringify(store), 'utf8')

    await importFromSource()
    const refreshed = await crmGet('t_seed_pc_1')
    expect(refreshed!.firm).toBe('Phillips & Cohen LLP') // SOURCE refreshed
    expect(refreshed!.status).toBe('request_sent') // STATE still untouched
  })

  it('flags contacts removed from source as source_removed without deleting them', async () => {
    await setup()
    const live = JSON.parse(await readFile(path.join(FIXTURES, 'crm-live-sample.json'), 'utf8')) as CrmStore
    const ghost = { ...live.contacts[0], id: 't_seed_ghost_1' }
    await writeFile(temp.crmFile, JSON.stringify({ lastImport: null, contacts: [ghost] }), 'utf8')

    const res = await importFromSource()
    expect(res.added).toBe(3)
    expect(res.removed).toBe(1)

    const stillThere = await crmGet('t_seed_ghost_1')
    expect(stillThere).not.toBeNull()
    expect(stillThere!.history.some((h) => h.kind === 'source_removed')).toBe(true)

    // Re-import does not re-flag (idempotent removal).
    expect((await importFromSource()).removed).toBe(0)
  })

  it('imports the real seed roster read-only (smoke; skipped when absent)', async () => {
    temp = await makeTempCrm()
    const realSource = path.join(homedir(), 'Delilah', 'research', 'crm', 'fca_crm_seed.json')
    if (!existsSync(realSource)) return // portable: no-op off Jordan's machine
    const prev = process.env.GOL_CRM_SOURCE
    process.env.GOL_CRM_SOURCE = realSource
    restoreSource = () => {
      if (prev === undefined) delete process.env.GOL_CRM_SOURCE
      else process.env.GOL_CRM_SOURCE = prev
    }

    const res = await importFromSource()
    expect(res.added).toBeGreaterThanOrEqual(3)
    const pc = await crmGet('t_seed_pc_1')
    expect(pc).not.toBeNull()
    expect(pc!.fraud_history.length).toBeGreaterThan(0)
  })
})
