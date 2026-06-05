import { useState } from 'react'

/**
 * Step 1 placeholder shell. The real view router (driven by global-hotkey IPC
 * events) is wired up in Step 3 (src/renderer/views).
 */
export function App() {
  const [ready] = useState(true)
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-neutral-100">
      <h1 className="text-lg font-semibold">Game of Life{ready ? '' : '...'}</h1>
    </div>
  )
}
