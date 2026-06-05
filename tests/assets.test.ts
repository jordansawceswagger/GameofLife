import { describe, it, expect } from 'vitest'
import { statSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const soundsDir = path.resolve(here, '..', 'assets', 'sounds')

describe('done chime asset', () => {
  it('done.wav exists and is non-zero', () => {
    const wav = path.join(soundsDir, 'done.wav')
    expect(existsSync(wav)).toBe(true)
    expect(statSync(wav).size).toBeGreaterThan(0)
  })

  it('CREDITS.md attests a known permissive license', () => {
    const credits = readFileSync(path.join(soundsDir, 'CREDITS.md'), 'utf8')
    expect(credits).toMatch(/CC0|CC-BY|Public Domain|Mixkit License|Pixabay License/)
  })
})
