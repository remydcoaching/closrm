import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'renderer/src') },
  },
  test: {
    environment: 'jsdom',
    include: ['renderer/src/**/*.test.{ts,tsx}', 'main/**/*.test.ts'],
  },
})
