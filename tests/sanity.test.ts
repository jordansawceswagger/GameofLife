import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('runs the test harness and arithmetic works', () => {
    expect(1 + 1).toBe(2)
  })

  it('has access to a Node environment', () => {
    expect(typeof process.cwd()).toBe('string')
  })
})
