import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  // relative paths, so the build works from any folder (e.g. GitHub Pages)
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      // the playground, and the OBS overlay (overlay.html?theme=…&play=1)
      input: { main: resolve(__dirname, 'index.html'), overlay: resolve(__dirname, 'overlay.html') },
    },
  },
})
