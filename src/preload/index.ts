import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { NAVIGATE_CHANNEL, type ViewName } from '../shared/views'
import type { GolApi } from '../shared/api'

// Step 3: navigation only. Step 4 expands `api` to the full file/Claude/CRM bridge.
const api: GolApi = {
  onNavigate(cb: (view: ViewName) => void): () => void {
    const listener = (_event: IpcRendererEvent, view: ViewName): void => cb(view)
    ipcRenderer.on(NAVIGATE_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(NAVIGATE_CHANNEL, listener)
    }
  },
}

contextBridge.exposeInMainWorld('gol', api)
