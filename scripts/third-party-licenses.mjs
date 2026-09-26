// Writes THIRD_PARTY_LICENSES.txt: the licenses of everything bundled into the builds (the
// fonts are SIL OFL 1.1, the rest MIT). Run after changing dependencies: npm run licenses
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BUNDLED = [
  ['@fontsource/inter', 'Inter font (embedded)'],
  ['@fontsource/space-grotesk', 'Space Grotesk font (embedded)'],
  ['@fontsource/jetbrains-mono', 'JetBrains Mono font (embedded)'],
  ['@fontsource/silkscreen', 'Silkscreen font (embedded)'],
  ['@fontsource/press-start-2p', 'Press Start 2P font (embedded)'],
  ['react', 'React (settings pages)'],
  ['react-dom', 'React DOM (settings pages)'],
  ['scheduler', 'scheduler (part of React DOM)'],
  ['gifenc', 'gifenc (GIF export)'],
]

const parts = BUNDLED.map(([pkg, what]) => {
  const dir = resolve('node_modules', pkg)
  const { version, license } = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'))
  const file = readdirSync(dir).find((f) => /^licen[sc]e/i.test(f))
  if (!file) throw new Error(`no license file in ${pkg}`)
  return `── ${what}: ${pkg}@${version} (${license}) ──\n\n${readFileSync(resolve(dir, file), 'utf8').trim()}\n`
})
writeFileSync(
  'THIRD_PARTY_LICENSES.txt',
  `Clawd Widget includes the following third-party software. Its own code is under the MIT license in LICENSE.\n\n${parts.join('\n')}`,
)
console.log(`THIRD_PARTY_LICENSES.txt: ${BUNDLED.length} packages`)
