import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cp, rm, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  readDailyNote,
  writeDailyNote,
  appendToCompletionLog,
  readMovementCards,
  readTaskQueue,
  appendToTaskQueue,
  parseMovementCards,
  parseTaskQueue,
  VaultFileNotFoundError,
} from '../src/main/vault'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_VAULT = path.join(here, 'fixtures', 'vault')
const prevRoot = process.env.GOL_VAULT_ROOT

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'gol-vault-'))
  await cp(FIXTURE_VAULT, root, { recursive: true })
  process.env.GOL_VAULT_ROOT = root
})

afterEach(async () => {
  if (prevRoot === undefined) delete process.env.GOL_VAULT_ROOT
  else process.env.GOL_VAULT_ROOT = prevRoot
  await rm(root, { recursive: true, force: true })
})

const dailyPath = (date: string) => path.join(root, '40_Daily Notes', `${date}.md`)

describe('vault: daily notes', () => {
  it('parses frontmatter into typed fields and extracts body sections', async () => {
    const note = await readDailyNote('2026-06-05')
    expect(note.date).toBe('2026-06-05')
    expect(note.frontmatter.streak_day).toBe(7)
    expect(note.frontmatter.top_three).toEqual(['Ship CRM layer', 'Despiral AM', 'Outreach x3'])
    expect(Object.keys(note.sections)).toEqual(
      expect.arrayContaining(['Morning Intake', 'Despiral Log', 'Completion Log', 'Life Breaks']),
    )
    expect(note.sections['Morning Intake']).toContain('scattered')
    // The `###` subheading stays inside its parent `##` section.
    expect(note.sections['Despiral Log']).toContain("Today's structural read")
  })

  it('round-trips raw content (read -> write -> read = same)', async () => {
    const raw = await readFile(dailyPath('2026-06-05'), 'utf8')
    const original = await readDailyNote('2026-06-05')

    await writeDailyNote('2026-06-09', raw)
    const copy = await readDailyNote('2026-06-09')
    expect(copy).toEqual(original)

    const writtenRaw = await readFile(dailyPath('2026-06-09'), 'utf8')
    expect(writtenRaw).toBe(raw)
  })

  it('throws a typed error when the note does not exist', async () => {
    await expect(readDailyNote('1999-01-01')).rejects.toBeInstanceOf(VaultFileNotFoundError)
  })

  it('appends a row to the Completion Log table and re-parses cleanly', async () => {
    await appendToCompletionLog('2026-06-05', {
      time: '09:14',
      task: 'Shipped CRM layer',
      tier: 'macro',
      card: 'Full Big 4',
      felt: 'open',
    })
    const raw = await readFile(dailyPath('2026-06-05'), 'utf8')
    expect(raw).toContain('| 09:14 | Shipped CRM layer |')

    const note = await readDailyNote('2026-06-05')
    expect(note.sections['Completion Log']).toContain('09:14')
    // The Life Breaks section after the table is untouched.
    expect(Object.keys(note.sections)).toContain('Life Breaks')
  })
})

describe('vault: movement cards', () => {
  it('returns micro/meso/macro as arrays of card strings', async () => {
    const cards = await readMovementCards()
    expect(cards.micro).toContain('Perineum drop, 3 breaths')
    expect(cards.meso.length).toBe(2)
    expect(cards.macro).toContain('Full Big 4, all four pairs bottom up')
  })

  it('ignores bullets that appear before the first tier heading', () => {
    const parsed = parseMovementCards(
      ['- stray bullet', '## Tier 1 - Micro', '- real card'].join('\n'),
    )
    expect(parsed.micro).toEqual(['real card'])
  })
})

describe('vault: task queue', () => {
  it('returns NOW/NEXT/LATER as arrays and drops empty placeholders', async () => {
    const q = await readTaskQueue()
    expect(q.now).toEqual(['Ship CRM data layer #delilah'])
    expect(q.next).toEqual(['Wire CRM popover #delilah', 'Draft outreach template #copy'])
    expect(q.later).toEqual([])
  })

  it('ignores the Done and Tag Legend sections', () => {
    const q = parseTaskQueue(
      ['## NOW', '- [ ] a', '## Done - Last 7 Days', '- [ ] should be ignored'].join('\n'),
    )
    expect(q.now).toEqual(['a'])
  })

  it('appends a row that parses back into the right column', async () => {
    await appendToTaskQueue('next', 'New captured task #copy')
    const q = await readTaskQueue()
    expect(q.next).toContain('New captured task #copy')
    // Existing items are preserved.
    expect(q.next).toContain('Wire CRM popover #delilah')
  })
})
