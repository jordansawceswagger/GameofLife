import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { NAVIGATE_CHANNEL, type ViewName } from '../shared/views'
import { IPC } from '../shared/ipc-channels'
import type { GolApi } from '../shared/api'

// The single bridge surface. Renderer code only ever sees `window.gol`; all Node
// access lives behind these typed methods. Return types come from GolApi, so the
// `any` that ipcRenderer.invoke produces is contained here and never leaks out.
const api: GolApi = {
  onNavigate(cb: (view: ViewName) => void): () => void {
    const listener = (_event: IpcRendererEvent, view: ViewName): void => cb(view)
    ipcRenderer.on(NAVIGATE_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(NAVIGATE_CHANNEL, listener)
    }
  },

  readFile: (path) => ipcRenderer.invoke(IPC.readFile, path),
  writeFile: (path, content) => ipcRenderer.invoke(IPC.writeFile, path, content),

  runClaudeCode: (prompt) => ipcRenderer.invoke(IPC.runClaudeCode, prompt),

  getDailyNote: (date) => ipcRenderer.invoke(IPC.getDailyNote, date),
  rollMovementCard: (tier) => ipcRenderer.invoke(IPC.rollMovementCard, tier),

  crmList: () => ipcRenderer.invoke(IPC.crmList),
  crmGet: (id) => ipcRenderer.invoke(IPC.crmGet, id),
  crmAppendHistory: (id, kind, detail, from, to) =>
    ipcRenderer.invoke(IPC.crmAppendHistory, id, kind, detail, from ?? null, to ?? null),
  crmMutate: (id, field, value) => ipcRenderer.invoke(IPC.crmMutate, id, field, value),
  crmImport: () => ipcRenderer.invoke(IPC.crmImport),
}

contextBridge.exposeInMainWorld('gol', api)
