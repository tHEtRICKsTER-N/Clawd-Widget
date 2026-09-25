import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Desktop widget pages, loaded by Electron from dist-desktop/ via file:// (hence base './').
export default defineConfig({
  root: resolve(__dirname),
  base: './',
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: resolve(__dirname, '../dist-desktop'),
    emptyOutDir: true,
    rollupOptions: {
      input: { widget: resolve(__dirname, 'widget.html'), settings: resolve(__dirname, 'settings.html') },
    },
  },
})
