/** Three hops; every landing slams a shockwave through the grid and pops confetti. */

import { front } from '../clawd'
import { DOT, DOT2, STAR, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

const JUMPS = [0.25, 1.25, 2.25]
const AIR = 0.38
const PIECES: string[][] = [DOT, DOT2, ['#', '#'], ['#.', '.#']]

export const jump: AnimationDef = {
  id: 'jump',
  name: 'Jump Party',
  icon: '🎉',
  description: 'Three big hops, confetti and a shockwave on every landing',
  duration: 3.5,
  loopFrom: 0,
  pose(t) {
    let i = -1
    JUMPS.forEach((j, k) => t >= j && (i = k))
    if (i < 0) return pose(front(), { name: 'stand' })
    const u = t - JUMPS[i]
    if (u < 0.12) return pose(front({ legs: 'crouch', eyes: 'closed', left: 'down', right: 'down' }), { name: 'crouch' })
    if (u < 0.12 + AIR) {
      const f = (u - 0.12) / AIR
      const h = Math.round(7 * 4 * f * (1 - f))
      return pose(front({ legs: 'air', dy: -h, eyes: 'happy', left: 'high', right: 'high' }), { name: 'air' })
    }
    if (u < 0.62) return pose(front({ legs: 'crouch', eyes: 'happy', left: 'up', right: 'up' }), { name: 'land' })
    if (i === JUMPS.length - 1 && t < 3.15) return pose(front({ eyes: 'happy', left: 'high', right: 'high' }), { name: 'yay' })
    return pose(front(), { name: 'stand' })
  },
  pulses(t) {
    const ev: PulseEvent[] = []
    JUMPS.forEach((j, k) => {
      ev.push([j + 0.12, 'strum', { strength: 0.38 }])
      ev.push([j + 0.12 + AIR, 'land', { strength: k === 2 ? 1 : 0.86 }])
    })
    return scheduled(t, ev, 600)
  },
  particles(t) {
    const out: Particle[] = []
    JUMPS.forEach((j, n) => {
      // sparkles at the top of the hop
      const s = t - (j + 0.28)
      if (s >= 0 && s < 0.22) {
        for (let k = 0; k < 3; k++) {
          if ((Math.floor(s / 0.05) + k) % 2) continue
          const side = k % 2 ? 1 : -1
          out.push({ x: side > 0 ? 28 + k * 2 : 1 + k, y: 3 + Math.round(hash(n * 7 + k + 3) * 8), glyph: STAR, color: 'fxLight', alpha: 1 })
        }
      }
      // confetti on landing
      const a = t - (j + 0.12 + AIR)
      if (a < 0 || a > 0.9) return
      const count = n === 2 ? 14 : 10
      for (let k = 0; k < count; k++) {
        const seed = n * 50 + k
        // two fountains, one either side of the feet
        const right = k % 2 === 1
        const ang = right ? -Math.PI * (0.1 + 0.35 * hash(seed)) : -Math.PI * (0.55 + 0.35 * hash(seed))
        const sp = 24 + hash(seed + 7) * 18
        out.push({
          x: (right ? 26 : 6) + Math.round(Math.cos(ang) * sp * a),
          y: 22 + Math.round(Math.sin(ang) * sp * a + 0.5 * 58 * a * a),
          glyph: PIECES[k % PIECES.length],
          color: (['c0', 'c1', 'c2', 'c3'] as const)[k % 4],
          alpha: a > 0.65 ? 0.6 : 1,
        })
      }
    })
    return out
  },
}
