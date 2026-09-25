// Builds the browser extension into dist-extension/ (load it via chrome://extensions → "Load unpacked").
// Two passes: popup/options/background as normal pages, then the content script as one IIFE file
// (content scripts can't be ES modules). Fonts are inlined so pages' CSP can't block them.
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const root = resolve('extension')
const outDir = resolve('dist-extension')

await build({
  configFile: false,
  root,
  base: './',
  plugins: [react()],
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        options: resolve(root, 'options.html'),
        background: resolve(root, 'src/background.ts'),
      },
      output: { entryFileNames: (c) => (c.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js') },
    },
  },
})

await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir,
    emptyOutDir: false,
    lib: { entry: resolve(root, 'src/content.ts'), formats: ['iife'], name: 'ClawdWidget', fileName: () => 'content.js' },
  },
})

console.log('Extension built → dist-extension/  (chrome://extensions → Developer mode → Load unpacked)')
