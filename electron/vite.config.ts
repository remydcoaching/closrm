import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  root: path.resolve(__dirname, 'renderer'),
  // Root cause of the M3-A white-screen bug: with `root` set to `renderer/`,
  // Vite looked for .env.local under electron/renderer/ instead of
  // electron/ (where .env.example documents it and where it was actually
  // created). import.meta.env.VITE_SUPABASE_URL/ANON_KEY were always
  // undefined, so src/lib/supabase.ts's own startup guard threw before
  // main.tsx ever mounted <App/> — an uncaught module-level error with no
  // Electron-side symptom, only visible in the renderer DevTools console.
  envDir: __dirname,
  plugins: [
    react(),
    electron({
      main: {
        entry: path.resolve(__dirname, 'main/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/main'),
            rollupOptions: { external: ['electron'] },
          },
        },
      },
      preload: {
        input: path.resolve(__dirname, 'preload/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/preload'),
            rollupOptions: { external: ['electron'] },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer/src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-electron/renderer'),
    // outDir is outside the Vite root, so Vite doesn't empty it by default:
    // every past build's bundles piled up and were packaged into the app.
    emptyOutDir: true,
  },
})
