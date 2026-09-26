import { defineConfig, type Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repo = resolve(__dirname, '../..')

/** the renderer's `./fonts` becomes the lazy loader: each font is fetched when first used */
const lazyFonts: Plugin = {
  name: 'clawd-lazy-fonts',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source === './fonts' && importer && resolve(importer) === resolve(repo, 'src/core/renderer.ts')) return resolve(repo, 'src/wc/fonts-lazy.ts')
    return null
  },
}

/** the bundled fonts are SIL OFL 1.1, whose notice and license go along with every copy */
const FONTS = ['inter', 'space-grotesk', 'jetbrains-mono', 'silkscreen', 'press-start-2p']
const fontLicenses: Plugin = {
  name: 'clawd-font-licenses',
  generateBundle() {
    const text = FONTS.map((f) => `── ${f} (@fontsource/${f}) ──\n\n${readFileSync(resolve(repo, 'node_modules/@fontsource', f, 'LICENSE'), 'utf8').trim()}\n`).join('\n')
    this.emitFile({ type: 'asset', fileName: 'FONTS-LICENSE.txt', source: `The fonts in chunks/ are embedded from these projects, each under the SIL Open Font License 1.1:\n\n${text}` })
  },
}

// npm package: <clawd-button> as an ES module with no dependencies (npm run build:wc).
export default defineConfig({
  root: __dirname,
  publicDir: false,
  plugins: [lazyFonts, fontLicenses],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    lib: { entry: resolve(repo, 'src/wc/index.ts'), formats: ['es'], fileName: () => 'clawd-button.js' },
    rollupOptions: { output: { chunkFileNames: 'chunks/[name]-[hash].js' } },
  },
})
