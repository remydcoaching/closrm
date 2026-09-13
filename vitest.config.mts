import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // mobile/ is a separate Expo/React Native project with its own Jest
    // runner (mobile/jest.config.js) — React Native ships untranspiled Flow
    // syntax that Vitest's esbuild transform can't parse, so its tests must
    // never be picked up by the root Vitest run.
    exclude: ['**/node_modules/**', 'mobile/**'],
  },
})
