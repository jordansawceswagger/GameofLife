import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import { makeTempCrm, FIXTURES, type TempCrm } from './helpers'
import {
  crmAddNote,
  crmCycleStatus,
  crmSetTerminal,
  crmCycleAvatar,
  crmSetMatchedSample,
  crmSetDNC,
  crmFlagAccepted,
  crmFlagReplied,
  crmFlagFollowedUp,
  crmGet,
} from '../../src/main/crm/store'
import { todayISODate } from '../../src/main/crm/time'
import type { CrmContact, HistoryEntry } from '../../src/main/crm/types'

let temp: TempCrm
const ID = 't_seed_pc_1'

beforeEach(async () => {
  temp = await makeTempCrm()
  await copyFile(path.join(FIXTURES, 'crm-live-sample.json'), temp.crmFile)
})
afterEach(async () => {
  await temp.cleanup()
})

const last = (c: CrmContact): HistoryEntry => c.history[c.history.length - 1]

describe('crm mutations (materialized field + history + lastTouch)', () => {
  it('crmAddNote updates notes, appends a note entry, bumps lastTouch', async () => {
    const c = await crmAddNote(ID, 'test note')
    expect(c.notes).toContain('test note')
    expect(last(c).kind).toBe('note')
    expect(last(c).detail).toBe('test note')
    expect(c.lastTouch).toBe(todayISODate())
  })

  it('crmCycleStatus advances research -> request_sent with from/to recorded', async () => {
    const c = await crmCycleStatus(ID)
    expect(c.status).toBe('request_sent')
    expect(last(c).kind).toBe('status_change')
    expect(last(c).from).toBe('research')
    expect(last(c).to).toBe('request_sent')
    expect(c.lastTouch).toBe(todayISODate())
  })

  it('crmSetTerminal requires a detail and records kind=status_change', async () => {
    await expect(crmSetTerminal(ID, 'parked', '   ')).rejects.toThrow()
    const c = await crmSetTerminal(ID, 'parked', 'On hold pending Q3 review')
    expect(c.status).toBe('parked')
    expect(last(c).kind).toBe('status_change')
    expect(last(c).detail).toBe('On hold pending Q3 review')
    expect(last(c).to).toBe('parked')
    expect(last(c).from).toBe('research')
  })

  it('crmCycleAvatar cycles null -> A -> B -> A+B -> null and logs avatar_change', async () => {
    expect((await crmCycleAvatar(ID)).avatar).toBe('A')
    expect((await crmCycleAvatar(ID)).avatar).toBe('B')
    expect((await crmCycleAvatar(ID)).avatar).toBe('A+B')
    const back = await crmCycleAvatar(ID)
    expect(back.avatar).toBeNull()
    expect(last(back).kind).toBe('avatar_change')
  })

  it('crmSetMatchedSample sets the value and logs matched_sample', async () => {
    const c = await crmSetMatchedSample(ID, 'davita')
    expect(c.matchedSample).toBe('davita')
    expect(last(c).kind).toBe('matched_sample')
    expect(last(c).to).toBe('davita')
  })

  it('crmSetDNC sets doNotContact + reason and logs a flag', async () => {
    const c = await crmSetDNC(ID, 'asked to stop')
    expect(c.doNotContact).toBe(true)
    expect(c.dncReason).toBe('asked to stop')
    expect(last(c).kind).toBe('flag')
    expect(last(c).detail).toContain('asked to stop')
  })

  it('crmFlagAccepted / Replied / FollowedUp set their flag and the right history kind', async () => {
    const a = await crmFlagAccepted(ID)
    expect(a.accepted).toBe(true)
    expect(last(a).kind).toBe('connection_accepted')

    const r = await crmFlagReplied(ID)
    expect(r.replied).toBe(true)
    expect(last(r).kind).toBe('reply_received')

    const f = await crmFlagFollowedUp(ID)
    expect(f.followedUp).toBe(true)
    expect(last(f).kind).toBe('note')
    expect(last(f).detail).toBe('follow-up sent')
  })

  it('throws for an unknown contact id', async () => {
    await expect(crmAddNote('nope', 'x')).rejects.toThrow(/not found/i)
    expect(await crmGet('nope')).toBeNull()
  })
})
