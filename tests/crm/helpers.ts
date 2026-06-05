import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const FIXTURES = path.resolve(here, '..', 'fixtures')

export interface TempCrm {
  dir: string
  crmFile: string
  backupsDir: string
  cleanup: () => Promise<void>
}

/** Create an isolated temp CRM dir and point GOL_CRM_DIR at it. */
export async function makeTempCrm(): Promise<TempCrm> {
  const prev = process.env.GOL_CRM_DIR
  const dir = await mkdtemp(path.join(tmpdir(), 'gol-crm-'))
  process.env.GOL_CRM_DIR = dir
  return {
    dir,
    crmFile: path.join(dir, 'crm.json'),
    backupsDir: path.join(dir, 'backups'),
    cleanup: async () => {
      if (prev === undefined) delete process.env.GOL_CRM_DIR
      else process.env.GOL_CRM_DIR = prev
      await rm(dir, { recursive: true, force: true })
    },
  }
}

/** Point GOL_CRM_SOURCE at the sample roster fixture. Returns a restore fn. */
export function useSourceFixture(): () => void {
  const prev = process.env.GOL_CRM_SOURCE
  process.env.GOL_CRM_SOURCE = path.join(FIXTURES, 'crm-source-sample.json')
  return () => {
    if (prev === undefined) delete process.env.GOL_CRM_SOURCE
    else process.env.GOL_CRM_SOURCE = prev
  }
}
