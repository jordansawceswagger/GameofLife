import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Default test environment is Node (main-process modules).
// Renderer tests opt into jsdom per-file with a `// @vitest-environment jsdom` docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
})
