/** IPC channel names for the request/response (invoke/handle) bridge methods. */
export const IPC = {
  readFile: 'gol:readFile',
  writeFile: 'gol:writeFile',
  runClaudeCode: 'gol:runClaudeCode',
  getDailyNote: 'gol:getDailyNote',
  rollMovementCard: 'gol:rollMovementCard',
  crmList: 'gol:crmList',
  crmGet: 'gol:crmGet',
  crmAppendHistory: 'gol:crmAppendHistory',
  crmMutate: 'gol:crmMutate',
  crmImport: 'gol:crmImport',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
