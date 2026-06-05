import os from 'node:os'
import path from 'node:path'

// LIVE store: the only place the app writes CRM data. Overridable via
// GOL_CRM_DIR (tests point this at a temp dir). SOURCE roster is read-only;
// overridable via GOL_CRM_SOURCE.

export function crmDir(): string {
  return process.env.GOL_CRM_DIR ?? path.join(os.homedir(), 'GameOfLife', 'crm')
}

export function crmFilePath(): string {
  return path.join(crmDir(), 'crm.json')
}

export function crmBackupsDir(): string {
  return path.join(crmDir(), 'backups')
}

export function crmSourcePath(): string {
  return (
    process.env.GOL_CRM_SOURCE ??
    path.join(os.homedir(), 'Delilah', 'research', 'crm', 'fca_crm_seed.json')
  )
}
