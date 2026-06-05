import { ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { IPC } from '../shared/ipc-channels'
import type { MovementTier } from '../shared/vault-types'
import type { HistoryKind } from './crm/types'
import { readDailyNote, rollMovementCard } from './vault'
import { runClaudeCode } from './claude'
import { crmList, crmGet, crmAppendHistory, crmMutate } from './crm/store'
import { importFromSource } from './crm/import'

/** Registers all ipcMain handlers backing the preload bridge. */
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

  ipcMain.handle(IPC.crmList, () => crmList())
  ipcMain.handle(IPC.crmGet, (_event, id: string) => crmGet(id))
  ipcMain.handle(
    IPC.crmAppendHistory,
    (_event, id: string, kind: HistoryKind, detail: string, from: string | null, to: string | null) =>
      crmAppendHistory(id, kind, detail, from, to),
  )
  ipcMain.handle(IPC.crmMutate, (_event, id: string, field: string, value: unknown) =>
    crmMutate(id, field, value),
  )
  ipcMain.handle(IPC.crmImport, () => importFromSource())
}
