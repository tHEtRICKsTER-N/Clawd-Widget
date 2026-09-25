/**
 * Bundled fonts, embedded as data and registered with the FontFace API from an
 * ArrayBuffer. Because nothing is fetched by URL, this works inside any page
 * (including ones with a strict Content-Security-Policy) when used by the
 * extension, and offline in the desktop widget.
 */

import type { FontId } from './settings'
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?inline'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?inline'
import space400 from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?inline'
import space700 from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?inline'
import mono400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?inline'
import mono700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?inline'
import silk400 from '@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2?inline'
import silk700 from '@fontsource/silkscreen/files/silkscreen-latin-700-normal.woff2?inline'
import press400 from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?inline'

const FILES: Partial<Record<FontId, { family: string; faces: [number, string][] }>> = {
  inter: { family: 'Clawd Inter', faces: [[400, inter400], [600, inter600]] },
  space: { family: 'Clawd Space Grotesk', faces: [[400, space400], [700, space700]] },
  mono: { family: 'Clawd JetBrains Mono', faces: [[400, mono400], [700, mono700]] },
  silkscreen: { family: 'Clawd Silkscreen', faces: [[400, silk400], [700, silk700]] },
  press: { family: 'Clawd Press Start 2P', faces: [[400, press400]] },
}

const loaded = new Map<FontId, Promise<void>>()

function dataUrlToBuffer(url: string): ArrayBuffer {
  const b64 = url.slice(url.indexOf(',') + 1)
  const bin = atob(b64)
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
      def.faces.map(async ([weight, url]) => {
        const face = new FontFace(def.family, dataUrlToBuffer(url), { weight: String(weight), style: 'normal' })
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
