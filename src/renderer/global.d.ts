import type { GolApi } from '../shared/api'

declare global {
  interface Window {
    gol: GolApi
  }
}

export {}
