import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { crmDir, crmFilePath, crmBackupsDir } from './paths'
import {
  atomicWriteJSON,
  readJSON,
  snapshotBackup,
  cleanupOrphanTmp,
  type AtomicWriteOptions,
} from './atomic'
import { backupStamp } from './time'
import type { CrmStore } from './types'

const EMPTY_STORE: CrmStore = { contacts: [], lastImport: null }

/** Create the CRM directory tree and an empty store on first launch. */
export async function ensureStore(): Promise<void> {
  await mkdir(crmDir(), { recursive: true })
  await mkdir(crmBackupsDir(), { recursive: true })
  await cleanupOrphanTmp(crmFilePath()) // recover from an interrupted write
  if (!existsSync(crmFilePath())) {
    await atomicWriteJSON(crmFilePath(), EMPTY_STORE)
  }
}

export async function loadStore(): Promise<CrmStore> {
  if (!existsSync(crmFilePath())) return { contacts: [], lastImport: null }
  return readJSON<CrmStore>(crmFilePath())
}

/**
 * THE single write path for crm.json. Snapshots the prior (good) version into
 * backups, then atomically writes the new store. opts.onBeforeRename lets tests
 * exercise the crash seam.
 */
export async function persistStore(store: CrmStore, opts?: AtomicWriteOptions): Promise<void> {
  await snapshotBackup(crmFilePath(), crmBackupsDir(), backupStamp())
  await atomicWriteJSON(crmFilePath(), store, opts)
}
