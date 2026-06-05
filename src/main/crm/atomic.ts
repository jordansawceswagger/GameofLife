import { rename, mkdir, readFile, copyFile, readdir, unlink, open } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

export interface AtomicWriteOptions {
  /**
   * Test/crash hook fired AFTER fsync and BEFORE rename. Throwing here simulates
   * a crash at the exact seam the recovery test targets: the .tmp is durable on
   * disk but the live file is never replaced.
   */
  onBeforeRename?: () => void | Promise<void>
}

/**
 * Crash-safe write: serialize to `<file>.tmp`, fsync it, then atomically rename
 * over the target. If the process dies between fsync and rename, the original
 * file is untouched and the .tmp is a recoverable orphan.
 */
export async function atomicWriteJSON(
  filePath: string,
  data: unknown,
  opts?: AtomicWriteOptions,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  const json = `${JSON.stringify(data, null, 2)}\n`

  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(json, 'utf8')
    await handle.sync() // fsync: durable before rename
  } finally {
    await handle.close()
  }

  if (opts?.onBeforeRename) await opts.onBeforeRename()

  await rename(tmp, filePath)
}

export async function readJSON<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

/** Remove a leftover `<file>.tmp` orphan from an interrupted write. */
export async function cleanupOrphanTmp(filePath: string): Promise<boolean> {
  const tmp = `${filePath}.tmp`
  if (existsSync(tmp)) {
    await unlink(tmp)
    return true
  }
  return false
}

/**
 * Copy the current file into backupsDir as crm-<stamp>.json (if it exists),
 * then prune to the most recent `keep`.
 */
export async function snapshotBackup(
  filePath: string,
  backupsDir: string,
  stamp: string,
  keep = 50,
): Promise<string | null> {
  if (!existsSync(filePath)) return null
  await mkdir(backupsDir, { recursive: true })
  const dest = path.join(backupsDir, `crm-${stamp}.json`)
  await copyFile(filePath, dest)
  await pruneBackups(backupsDir, keep)
  return dest
}

async function pruneBackups(backupsDir: string, keep: number): Promise<void> {
  const files = (await readdir(backupsDir))
    .filter((f) => f.startsWith('crm-') && f.endsWith('.json'))
    .sort() // stamp is lexicographically chronological
  const excess = files.length - keep
  for (let i = 0; i < excess; i++) {
    await unlink(path.join(backupsDir, files[i]))
  }
}
