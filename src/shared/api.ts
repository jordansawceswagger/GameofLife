import type { ViewName } from './views'
import type { DailyNote, MovementTier } from './vault-types'
// Type-only imports: erased at build time, so the renderer bundle never pulls in
// main-process code. They keep the bridge surface fully typed (no `any`).
import type { CrmContact, CrmImportResult, HistoryKind } from '../main/crm/types'

/**
 * The typed surface exposed to the renderer as `window.gol` via the preload
 * contextBridge. Single source of truth for the bridge shape across main,
 * preload, and renderer. Every cross-process call goes through here; the renderer
 * never touches Node directly.
 */
export interface GolApi {
  /** Subscribe to hotkey-driven navigation events. Returns an unsubscribe fn. */
  onNavigate(cb: (view: ViewName) => void): () => void

  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>

  runClaudeCode(prompt: string): Promise<{ response: string; error?: string }>

  getDailyNote(date: string): Promise<DailyNote>
  rollMovementCard(tier: MovementTier): Promise<string>

  crmList(): Promise<CrmContact[]>
  crmGet(id: string): Promise<CrmContact | null>
  crmAppendHistory(
    id: string,
    kind: HistoryKind,
    detail: string,
    from?: string | null,
    to?: string | null,
  ): Promise<CrmContact>
  crmMutate(id: string, field: string, value: unknown): Promise<CrmContact>
  crmImport(): Promise<CrmImportResult>
}
