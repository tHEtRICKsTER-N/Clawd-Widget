// Emit sprite + particle pixel rects (reference-px coords) for offline comparison / contact sheets.
// usage: tsx scripts/dump-sprite.ts <animId> t1 t2 ...
import { ANIMATIONS } from '../src/engine/animations'
import { PALETTE, SPRITE_ORIGIN, SPRITE_UNIT } from '../src/engine/sprites'
import type { AnimId } from '../src/engine/types'

const FX: Record<string, string> = {
  fx: '#f0c35a', fxLight: '#f8e0a6', fxAlt: '#e8a857', dim: '#78745f', energy: '#efe8ff', bot: '#d8764f',
  glow: '#a076f8', text: '#ffffff', c0: '#f0c35a', c1: '#efe8ff', c2: '#d8764f', c3: '#b391f9',
}
const [id, ...rest] = process.argv.slice(2)
const anim = ANIMATIONS[id as AnimId]
const U = SPRITE_UNIT
const P = (c: number, r: number) => [SPRITE_ORIGIN.x + c * U, SPRITE_ORIGIN.y + r * U]
const out = rest.map(Number).map((t) => {
  const rects: [number, number, number, number, string, number][] = []
  const st = anim.pose(t)
  if (st.frame) {
    const fr = st.frame
    const A = { c: 16.5, r: 25 }
    fr.rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === '.') return
        const cc = A.c + (fr.dx + c + st.ox - A.c) * st.scale
        const rr = A.r + (fr.dy + r + st.oy - A.r) * st.scale
        const [x, y] = P(cc, rr)
        rects.push([x, y, x + U * st.scale, y + U * st.scale, PALETTE[ch], st.opacity])
      }),
    )
  }
  for (const p of anim.particles(t))
    p.glyph.forEach((row, gy) =>
      [...row].forEach((ch, gx) => {
        if (ch !== '#') return
        const [x, y] = P(p.x + gx, p.y + gy)
        const col = gy === 0 && p.top ? p.top : p.color
        rects.push([x, y, x + U, y + U, FX[col] ?? col, p.alpha])
      }),
    )
  return { t, frame: st.name ?? '', rects }
})
process.stdout.write(JSON.stringify(out))
