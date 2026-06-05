import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const checklistPath = path.resolve(here, '..', 'MORNING_CHECKLIST.md')

describe('MORNING_CHECKLIST.md', () => {
  const exists = existsSync(checklistPath)
  const body = exists ? readFileSync(checklistPath, 'utf8') : ''

  it('exists in the repo root', () => {
    expect(exists).toBe(true)
  })

  it('has the expected section headers', () => {
    for (const header of [
      '## What got built',
      '## How to verify (do this first)',
      '## Decisions I made overnight',
      '## What you should add (deferred / next steps)',
      '## What might break first',
      '## Tests that did not pass (if any)',
      '## Sound file',
    ]) {
      expect(body, `missing header: ${header}`).toContain(header)
    }
  })

  it('references the basic verification steps', () => {
    expect(body).toContain('npm install')
    expect(body).toContain('npm test')
    expect(body).toContain('npm run typecheck')
    expect(body).toContain('npm run dev')
  })

  it('points at DECISIONS.md for the full decision log', () => {
    expect(body).toContain('DECISIONS.md')
  })
})
