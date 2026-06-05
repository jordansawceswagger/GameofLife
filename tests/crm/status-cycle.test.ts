import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import { makeTempCrm, FIXTURES, type TempCrm } from './helpers'
import { crmCycleStatus, crmSetTerminal, crmResetToLinear, crmGet } from '../../src/main/crm/store'
import { LINEAR_STATUSES } from '../../src/main/crm/types'

let temp: TempCrm
const ID = 't_seed_pc_1'

beforeEach(async () => {
  temp = await makeTempCrm()
  await copyFile(path.join(FIXTURES, 'crm-live-sample.json'), temp.crmFile)
})
afterEach(async () => {
  await temp.cleanup()
})

describe('status cycle semantics', () => {
  it('walks the full linear funnel then wraps back to research', async () => {
    const seen: string[] = []
    for (let i = 0; i < LINEAR_STATUSES.length; i++) {
      seen.push((await crmCycleStatus(ID)).status)
    }
    expect(seen).toEqual(['request_sent', 'connected', 'dm_sent', 'in_conversation', 'research'])
  })

  it('the S-key from a terminal state is a no-op (no status, history, or lastTouch change)', async () => {
    await crmSetTerminal(ID, 'parked', 'On hold pending Q3 review')
    const before = await crmGet(ID)

    const after = await crmCycleStatus(ID)
    expect(after.status).toBe('parked')
    expect(after.history.length).toBe(before!.history.length)
    expect(after.lastTouch).toBe(before!.lastTouch)
  })

  it('crmResetToLinear is the deliberate escape from a terminal state', async () => {
    await crmSetTerminal(ID, 'lost', 'went cold')
    const c = await crmResetToLinear(ID)
    expect(c.status).toBe('research')
    expect(c.history[c.history.length - 1].kind).toBe('status_change')
    // and cycling resumes from the linear funnel
    expect((await crmCycleStatus(ID)).status).toBe('request_sent')
  })
})
