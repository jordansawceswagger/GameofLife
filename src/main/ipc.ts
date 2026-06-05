import { ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { IPC } from '../shared/ipc-channels'

/**
 * Registers all ipcMain handlers backing the preload bridge. File I/O is wired
 * here in Step 4; the vault, Claude, and CRM handlers are added in Steps 5-7.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.readFile, (_event, path: string): Promise<string> => {
    return readFile(path, 'utf8')
  })

  ipcMain.handle(IPC.writeFile, async (_event, path: string, content: string): Promise<void> => {
    await writeFile(path, content, 'utf8')
  })
}
