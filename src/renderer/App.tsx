import { useEffect, useState } from 'react'
import type { ViewName } from '../shared/views'
import { StubView } from './views/StubView'

/**
 * Routes between the idle popover and the hotkey-driven stub views. Navigation
 * arrives from the main process over IPC, surfaced as window.gol.onNavigate.
 */
export function App() {
  const [view, setView] = useState<ViewName | null>(null)

  useEffect(() => {
    const off = window.gol?.onNavigate?.((next) => setView(next))
    return () => {
      if (typeof off === 'function') off()
    }
  }, [])

  if (!view) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-neutral-400">
        <h2 className="text-sm font-medium">Game of Life</h2>
      </div>
    )
  }

  return <StubView view={view} onClose={() => setView(null)} />
}
