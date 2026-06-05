import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import type {
  DailyNote,
  DailyNoteFrontmatter,
  TaskQueue,
  MovementCards,
  MovementTier,
  CompletionLogEntry,
} from '../shared/vault-types'

const DEFAULT_VAULT_ROOT = '/Users/jordan/Documents/Claude/Projects/Game of Life'

/** Vault root, overridable via GOL_VAULT_ROOT (tests point this at a temp dir). */
export function getVaultRoot(): string {
  return process.env.GOL_VAULT_ROOT ?? DEFAULT_VAULT_ROOT
}

export function dailyNotePath(date: string): string {
  return path.join(getVaultRoot(), '40_Daily Notes', `${date}.md`)
}

export function movementCardsPath(): string {
  return path.join(getVaultRoot(), '00_System', 'Movement Cards.md')
}

export function taskQueuePath(): string {
  return path.join(getVaultRoot(), '00_System', 'Task Queue.md')
}

/** Typed error for a missing vault file, so callers can degrade gracefully. */
export class VaultFileNotFoundError extends Error {
  constructor(public readonly filePath: string) {
    super(`Vault file not found: ${filePath}`)
    this.name = 'VaultFileNotFoundError'
  }
}

async function readFileOrThrow(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new VaultFileNotFoundError(file)
    }
    throw err
  }
}

/** Split a markdown body into a map of `## heading` -> section text. */
export function extractSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {}
  let current: string | null = null
  let buffer: string[] = []
  const flush = (): void => {
    if (current !== null) sections[current] = buffer.join('\n').trim()
  }
  for (const line of body.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)
    if (heading) {
      flush()
      current = heading[1].trim()
      buffer = []
    } else if (current !== null) {
      buffer.push(line)
    }
  }
  flush()
  return sections
}

/** YAML auto-parses an unquoted `2026-06-05` into a Date; normalize back to a
 * YYYY-MM-DD string so the schema (and round-trips) stay string-typed. */
function coerceDateString(value: unknown, fallback: string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value
  return fallback
}

export async function readDailyNote(date: string): Promise<DailyNote> {
  const raw = await readFileOrThrow(dailyNotePath(date))
  const parsed = matter(raw)
  const data = parsed.data as Record<string, unknown>
  const dateStr = coerceDateString(data.date, date)
  data.date = dateStr // normalize in place so frontmatter.date is a string
  const frontmatter = data as DailyNoteFrontmatter
  return {
    date: dateStr,
    frontmatter,
    body: parsed.content,
    sections: extractSections(parsed.content),
  }
}

export async function writeDailyNote(date: string, content: string): Promise<void> {
  const file = dailyNotePath(date)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content, 'utf8')
}

/** Parse Movement Cards markdown into the three reward tiers (pure, testable). */
export function parseMovementCards(body: string): MovementCards {
  const result: MovementCards = { micro: [], meso: [], macro: [] }
  let tier: MovementTier | null = null
  for (const line of body.split('\n')) {
    const heading = /^##\s+(.+)$/.exec(line)
    if (heading) {
      const h = heading[1].toLowerCase()
      if (h.includes('micro')) tier = 'micro'
      else if (h.includes('meso')) tier = 'meso'
      else if (h.includes('macro')) tier = 'macro'
      else tier = null
      continue
    }
    const bullet = /^\s*-\s+(.*\S)\s*$/.exec(line)
    if (bullet && tier) {
      result[tier].push(bullet[1].trim())
    }
  }
  return result
}

export async function readMovementCards(): Promise<MovementCards> {
  const raw = await readFileOrThrow(movementCardsPath())
  return parseMovementCards(matter(raw).content)
}

/** Roll one card from a tier (variable-reward draw for the Done overlay). */
export async function rollMovementCard(tier: MovementTier): Promise<string> {
  const cards = await readMovementCards()
  const pool = cards[tier]
  if (!pool || pool.length === 0) return ''
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Parse the Task Queue into NOW/NEXT/LATER (pure, testable). */
export function parseTaskQueue(body: string): TaskQueue {
  const result: TaskQueue = { now: [], next: [], later: [] }
  let column: keyof TaskQueue | null = null
  for (const line of body.split('\n')) {
    const heading = /^##\s+(.+)$/.exec(line)
    if (heading) {
      const h = heading[1].trim().toUpperCase()
      if (h === 'NOW') column = 'now'
      else if (h === 'NEXT') column = 'next'
      else if (h === 'LATER') column = 'later'
      else column = null // e.g. "Done - Last 7 Days", "Tag Legend"
      continue
    }
    const task = /^\s*-\s*\[[ xX]\]\s*(.*\S)?\s*$/.exec(line)
    if (task && column) {
      const text = (task[1] ?? '').trim()
      if (text) result[column].push(text)
    }
  }
  return result
}

export async function readTaskQueue(): Promise<TaskQueue> {
  const raw = await readFileOrThrow(taskQueuePath())
  return parseTaskQueue(matter(raw).content)
}

/** Insert a `- [ ] task` bullet at the end of a queue column (pure, testable). */
export function insertTaskRow(raw: string, column: keyof TaskQueue, task: string): string {
  const heading = column.toUpperCase()
  const lines = raw.split('\n')
  const re = new RegExp(`^##\\s+${heading}\\s*$`)
  const headingIdx = lines.findIndex((l) => re.test(l))
  if (headingIdx === -1) throw new Error(`Task Queue section not found: ${heading}`)

  let endIdx = lines.length
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i
      break
    }
  }

  let insertAt = headingIdx + 1
  for (let i = endIdx - 1; i > headingIdx; i--) {
    if (lines[i].trim() !== '') {
      insertAt = i + 1
      break
    }
  }

  lines.splice(insertAt, 0, `- [ ] ${task}`)
  return lines.join('\n')
}

export async function appendToTaskQueue(column: keyof TaskQueue, task: string): Promise<void> {
  const file = taskQueuePath()
  const raw = await readFileOrThrow(file)
  await writeFile(file, insertTaskRow(raw, column, task), 'utf8')
}

/** Insert a pipe-delimited row after the last table row in Completion Log. */
export function insertCompletionLogRow(raw: string, row: string): string {
  const lines = raw.split('\n')
  const headingIdx = lines.findIndex((l) => /^##\s+Completion Log\s*$/.test(l))
  if (headingIdx === -1) throw new Error('Completion Log section not found')

  let endIdx = lines.length
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i
      break
    }
  }

  let lastTableIdx = -1
  for (let i = headingIdx + 1; i < endIdx; i++) {
    if (/^\s*\|/.test(lines[i])) lastTableIdx = i
  }
  if (lastTableIdx === -1) lastTableIdx = endIdx - 1

  lines.splice(lastTableIdx + 1, 0, row)
  return lines.join('\n')
}

export async function appendToCompletionLog(
  date: string,
  entry: CompletionLogEntry,
): Promise<void> {
  const file = dailyNotePath(date)
  const raw = await readFileOrThrow(file)
  const row = `| ${entry.time} | ${entry.task} | ${entry.linked ?? ''} | ${entry.tier ?? ''} | ${entry.card ?? ''} | ${entry.felt ?? ''} |`
  await writeFile(file, insertCompletionLogRow(raw, row), 'utf8')
}
