import { describe, it, expect, vi, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: spawnMock }))

import { runClaudeCode, buildArgs, parseClaudeJson } from '../src/main/claude'

interface FakeChild extends EventEmitter {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: ReturnType<typeof vi.fn>
}

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn()
  return child
}

afterEach(() => {
  vi.useRealTimers()
})

describe('buildArgs', () => {
  it('builds the base argv from the prompt', () => {
    expect(buildArgs('say hello')).toEqual(['-p', 'say hello', '--output-format', 'json'])
  })

  it('appends --model when provided', () => {
    expect(buildArgs('hi', { model: 'claude-sonnet-4-6' })).toEqual([
      '-p',
      'hi',
      '--output-format',
      'json',
      '--model',
      'claude-sonnet-4-6',
    ])
  })
})

describe('parseClaudeJson', () => {
  it('extracts the result field', () => {
    expect(parseClaudeJson('{"result":"hi there"}')).toBe('hi there')
  })

  it('throws on invalid JSON (caller maps to an error)', () => {
    expect(() => parseClaudeJson('not json{{')).toThrow()
  })
})

describe('runClaudeCode', () => {
  it('spawns claude with the right argv', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const p = runClaudeCode('say hello')
    child.stdout.emit('data', Buffer.from('{"result":"ok"}'))
    child.emit('close', 0)
    await p
    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      ['-p', 'say hello', '--output-format', 'json'],
      expect.objectContaining({ cwd: undefined }),
    )
  })

  it('captures stdout and returns the parsed response on exit 0', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const p = runClaudeCode('hello')
    child.stdout.emit('data', Buffer.from('{"result":"Hello '))
    child.stdout.emit('data', Buffer.from('there"}'))
    child.emit('close', 0)
    await expect(p).resolves.toEqual({ response: 'Hello there' })
  })

  it('returns an error on non-zero exit and never throws', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const p = runClaudeCode('hello')
    child.stderr.emit('data', Buffer.from('boom'))
    child.emit('close', 2)
    const res = await p
    expect(res.response).toBe('')
    expect(res.error).toContain('code 2')
    expect(res.error).toContain('boom')
  })

  it('kills the process and returns a timeout error', async () => {
    vi.useFakeTimers()
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const p = runClaudeCode('hello', { timeout: 1000 })
    vi.advanceTimersByTime(1000)
    const res = await p
    expect(child.kill).toHaveBeenCalledWith('SIGKILL')
    expect(res.error).toContain('timed out')
    expect(res.response).toBe('')
  })

  it('returns a parse error on invalid JSON and never throws', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const p = runClaudeCode('hello')
    child.stdout.emit('data', Buffer.from('not json{{{'))
    child.emit('close', 0)
    const res = await p
    expect(res.response).toBe('')
    expect(res.error).toContain('parse')
  })

  it('returns an error when the process fails to spawn', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const p = runClaudeCode('hello')
    child.emit('error', new Error('spawn claude ENOENT'))
    const res = await p
    expect(res.response).toBe('')
    expect(res.error).toContain('ENOENT')
  })
})
