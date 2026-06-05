import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, readdir } from 'node:fs/promises'
import { makeTempCrm, type TempCrm } from './helpers'
import { snapshotBackup } from '../../src/main/crm/atomic'

let temp: TempCrm

beforeEach(async () => {
  temp = await makeTempCrm()
  await writeFile(temp.crmFile, JSON.stringify({ contacts: [], lastImport: null }), 'utf8')
})
afterEach(async () => {
  await temp.cleanup()
})

describe('backup retention', () => {
  it('keeps only the most recent 50 snapshots and prunes the oldest', async () => {
    for (let i = 0; i < 55; i++) {
      const stamp = `2026-06-05T00-00-00-${String(i).padStart(3, '0')}`
      await snapshotBackup(temp.crmFile, temp.backupsDir, stamp, 50)
    }
    const files = (await readdir(temp.backupsDir)).filter((f) => f.startsWith('crm-')).sort()
    expect(files).toHaveLength(50)
    // Oldest 5 (000..004) pruned; survivors are 005..054.
    expect(files[0]).toBe('crm-2026-06-05T00-00-00-005.json')
    expect(files[49]).toBe('crm-2026-06-05T00-00-00-054.json')
  })

  it('returns null and writes nothing when the source file is absent', async () => {
    const dest = await snapshotBackup(`${temp.dir}/does-not-exist.json`, temp.backupsDir, 'x', 50)
    expect(dest).toBeNull()
  })
})
