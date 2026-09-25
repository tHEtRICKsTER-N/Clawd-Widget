/**
 * The web component's font loader: the same fonts and API as core/fonts.ts, but each one is
 * its own chunk, fetched the first time it's used, so a page only downloads the font it
 * shows. The package build swaps this in for core/fonts.ts (packages/clawd-button/vite.config.ts).
 */

import type { FontId } from '../core/settings'

type Face = [weight: number, file: () => Promise<{ default: string }>]

const FILES: Partial<Record<FontId, { family: string; faces: Face[] }>> = {
  inter: {
    family: 'Clawd Inter',
    faces: [
      [400, () => import('@fontsource/inter/files/inter-latin-400-normal.woff2?inline')],
      [600, () => import('@fontsource/inter/files/inter-latin-600-normal.woff2?inline')],
    ],
  },
  space: {
    family: 'Clawd Space Grotesk',
    faces: [
      [400, () => import('@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?inline')],
      [700, () => import('@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?inline')],
    ],
  },
  mono: {
    family: 'Clawd JetBrains Mono',
    faces: [
      [400, () => import('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?inline')],
      [700, () => import('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?inline')],
    ],
  },
  silkscreen: {
    family: 'Clawd Silkscreen',
    faces: [
      [400, () => import('@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2?inline')],
      [700, () => import('@fontsource/silkscreen/files/silkscreen-latin-700-normal.woff2?inline')],
    ],
  },
  press: { family: 'Clawd Press Start 2P', faces: [[400, () => import('@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?inline')]] },
}

const loaded = new Map<FontId, Promise<void>>()

function dataUrlToBuffer(url: string): ArrayBuffer {
  const bin = atob(url.slice(url.indexOf(',') + 1))
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

/** Register a bundled font (no-op for system/custom fonts). Resolves when ready to render. */
export function ensureFont(id: FontId): Promise<void> {
  const def = FILES[id]
  if (!def || typeof FontFace === 'undefined') return Promise.resolve()
  let p = loaded.get(id)
  if (!p) {
    p = Promise.all(
      def.faces.map(async ([weight, file]) => {
        const face = new FontFace(def.family, dataUrlToBuffer((await file()).default), { weight: String(weight), style: 'normal' })
        await face.load()
        document.fonts.add(face)
      }),
    )
      .then(() => undefined)
      .catch(() => undefined)
    loaded.set(id, p)
  }
  return p
}
