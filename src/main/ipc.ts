import { ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { IPC } from '../shared/ipc-channels'
import type { MovementTier } from '../shared/vault-types'
import { readDailyNote, rollMovementCard } from './vault'
import { runClaudeCode } from './claude'

/**
 * Registers all ipcMain handlers backing the preload bridge. File I/O, vault, and
 * Claude handlers are wired here; the CRM handlers are added in Step 7.
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

  ipcMain.handle(IPC.runClaudeCode, (_event, prompt: string) => runClaudeCode(prompt))
}
