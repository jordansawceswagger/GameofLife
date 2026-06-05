// Time helpers for CRM records. A Date can be injected for deterministic tests.

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** ISO date only: YYYY-MM-DD (local). Used for lastTouch. */
export function todayISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** FULL ISO 8601 with local offset, e.g. 2026-06-05T09:14:03-07:00. History ts. */
export function nowISO(d: Date = new Date()): string {
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `${date}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** Filesystem-safe timestamp for backup filenames (no colons). Includes ms so
 * rapid successive backups never collide. */
export function backupStamp(d: Date = new Date()): string {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
  return `${date}T${time}`
}
