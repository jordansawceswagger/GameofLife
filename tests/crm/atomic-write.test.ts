import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, copyFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { makeTempCrm, FIXTURES, type TempCrm } from './helpers'
import { atomicWriteJSON, cleanupOrphanTmp, readJSON } from '../../src/main/crm/atomic'
import { crmFilePath } from '../../src/main/crm/paths'
import { crmAddNote } from '../../src/main/crm/store'

let temp: TempCrm

beforeEach(async () => {
  temp = await makeTempCrm()
  await copyFile(path.join(FIXTURES, 'crm-live-sample.json'), temp.crmFile)
})
afterEach(async () => {
  await temp.cleanup()
})

describe('atomic write crash safety', () => {
  it('a crash between fsync and rename leaves the original intact with a recoverable orphan tmp', async () => {
    const file = crmFilePath()
    const original = await readFile(file, 'utf8')

    await expect(
      atomicWriteJSON(
        file,
        { contacts: [], lastImport: 'CLOBBERED' },
        {
          onBeforeRename: () => {
            throw new Error('simulated crash between fsync and rename')
          },
        },
      ),
    ).rejects.toThrow('simulated crash')

    // The live file was never replaced.
    expect(await readFile(file, 'utf8')).toBe(original)

    // The durable .tmp orphan exists and is cleaned up on the next launch pass.
    expect(existsSync(`${file}.tmp`)).toBe(true)
    expect(await cleanupOrphanTmp(file)).toBe(true)
    expect(existsSync(`${file}.tmp`)).toBe(false)
  })

  it('the happy path renames the tmp away and replaces the content', async () => {
    const file = crmFilePath()
    await atomicWriteJSON(file, { contacts: [], lastImport: 'NEW' })
    expect((await readJSON<{ lastImport: string }>(file)).lastImport).toBe('NEW')
    expect(existsSync(`${file}.tmp`)).toBe(false)
  })

  it('a successful mutation snapshots the prior state into backups before writing', async () => {
    await crmAddNote('t_seed_pc_1', 'first note')
    const backups = (await readdir(temp.backupsDir)).filter(
      (f) => f.startsWith('crm-') && f.endsWith('.json'),
    )
    expect(backups.length).toBeGreaterThanOrEqual(1)
  })
})
