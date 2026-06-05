// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { App } from '../../src/renderer/App'
import { VIEW_NAMES, type ViewName } from '../../src/shared/views'

afterEach(cleanup)

function installGolBridge() {
  let handler: ((view: ViewName) => void) | null = null
  window.gol = {
    onNavigate: (cb: (view: ViewName) => void) => {
      handler = cb
      return () => {
        handler = null
      }
    },
  }
  return {
    navigate: (view: ViewName) =>
      act(() => {
        handler?.(view)
      }),
  }
}

describe('renderer view router', () => {
  it('renders the correct stub heading for each navigate event', () => {
    const { navigate } = installGolBridge()
    render(<App />)

    for (const view of VIEW_NAMES) {
      navigate(view)
      expect(screen.getByRole('heading', { name: view })).toBeTruthy()
    }
  })

  it('shows the idle shell before any navigation', () => {
    installGolBridge()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Game of Life' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'crm' })).toBeNull()
  })

  it('Close button returns to the idle shell', () => {
    const { navigate } = installGolBridge()
    render(<App />)

    navigate('crm')
    expect(screen.getByRole('heading', { name: 'crm' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('heading', { name: 'crm' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Game of Life' })).toBeTruthy()
  })
})
