import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

// Renderer lives at project root (index.html -> src/renderer/main.tsx).
// vite-plugin-electron compiles the Electron main + preload into dist-electron/.
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
      },
      preload: {
        input: 'src/preload/index.ts',
      },
      // Renderer-side Node polyfills handled by vite-plugin-electron-renderer below.
      renderer: {},
    }),
    renderer(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  clearScreen: false,
})
