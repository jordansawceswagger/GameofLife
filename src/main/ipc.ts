import { ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { IPC } from '../shared/ipc-channels'
import type { MovementTier } from '../shared/vault-types'
import { readDailyNote, rollMovementCard } from './vault'

/**
 * Registers all ipcMain handlers backing the preload bridge. File I/O and the
 * vault handlers are wired here; Claude and CRM handlers are added in Steps 6-7.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.readFile, (_event, path: string): Promise<string> => {
    return readFile(path, 'utf8')
  })

  ipcMain.handle(IPC.writeFile, async (_event, path: string, content: string): Promise<void> => {
    await writeFile(path, content, 'utf8')
  })

  ipcMain.handle(IPC.getDailyNote, (_event, date: string) => readDailyNote(date))
  ipcMain.handle(IPC.rollMovementCard, (_event, tier: MovementTier) => rollMovementCard(tier))
}
