/**
 * Secret (↑↑↓↓←→←→BA on the focused widget): a nod to the most famous cheat code. Clawd
 * looks around, leaps, lands with a big shockwave, stars light up across the grid and
 * "+30♥" floats over its head. Not in the picker, Random or the menus.
 */

import { front } from '../clawd'
import { DOT, DOT2, STAR, tinyText, tinyWidth, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

const TAKEOFF = 0.55
const LAND = 1.05
const PIECES: string[][] = [DOT, DOT2, ['#', '#'], ['#.', '.#']]
const LIVES = '+30♥'

export const konami: AnimationDef = {
  id: 'konami',
  name: '+30 lives',
  icon: '🕹️',
  description: 'The secret one',
  duration: 3.4,
  loopFrom: 0,
  pose(t) {
    if (t < 0.15) return pose(front({ eyes: 'wide' }), { name: 'huh' })
    if (t < 0.28) return pose(front({ eyes: 'lookL' }), { name: 'sneaky-l' })
    if (t < 0.41) return pose(front({ eyes: 'lookR' }), { name: 'sneaky-r' })
    if (t < TAKEOFF) return pose(front({ legs: 'crouch', eyes: 'closed', left: 'down', right: 'down' }), { name: 'crouch' })
    if (t < LAND) {
      const f = (t - TAKEOFF) / (LAND - TAKEOFF)
      const h = Math.round(6 * 4 * f * (1 - f))
      return pose(front({ legs: 'air', dy: -h, eyes: 'happy', left: 'high', right: 'high' }), { name: `leap ${h}` })
    }
    if (t < LAND + 0.15) return pose(front({ legs: 'crouch', eyes: 'happy', left: 'up', right: 'up' }), { name: 'land' })
    if (t < 3.0) {
      // victory: arms pumping in turn
      const k = Math.floor((t - LAND) / 0.2) % 2
      return pose(front({ eyes: 'happy', left: k ? 'high' : 'up', right: k ? 'up' : 'high' }), { name: k ? 'pump-l' : 'pump-r' })
    }
    return pose(front({ eyes: t > 3.2 && t < 3.3 ? 'closed' : 'open' }), { name: 'cool' })
  },
  pulses(t) {
    const ev: PulseEvent[] = [
      [TAKEOFF, 'strum', { strength: 0.5 }],
      [LAND, 'first', { strength: 1 }],
      [2.25, 'power', { strength: 0.8 }],
    ]
    // stars popping up all over the grid after the landing
    for (let i = 0; i < 14; i++)
      ev.push([LAND + 0.25 + i * 0.09, 'twinkle', { strength: 0.9, cx: 2.5 + Math.floor(hash(i + 300) * 56), cy: 0.5 + Math.floor(hash(i + 400) * 9.5) }])
    return scheduled(t, ev, 1600)
  },
  particles(t) {
    const out: Particle[] = []
    // a rainbow burst from the landing
    const a = t - LAND
    if (a >= 0 && a < 1.1) {
      for (let k = 0; k < 18; k++) {
        const ang = -Math.PI * (0.05 + 0.9 * (k / 17)) + (hash(k + 500) - 0.5) * 0.2
        const sp = 26 + hash(k + 600) * 20
        out.push({
          x: 16 + Math.round(Math.cos(ang) * sp * a),
          y: 20 + Math.round(Math.sin(ang) * sp * a + 0.5 * 50 * a * a),
          glyph: PIECES[k % PIECES.length],
          color: (['c0', 'c1', 'c2', 'c3'] as const)[k % 4],
          alpha: a > 0.8 ? 0.6 : 1,
        })
      }
    }
    // "+30♥" rises over its head and stays a while
    const u = t - (LAND + 0.2)
    if (u >= 0 && u < 2.0) {
      const y = Math.max(1, 6 - Math.floor(u * 12))
      out.push(...tinyText(LIVES, Math.round(16.5 - tinyWidth(LIVES) / 2), y, 'fx', u > 1.7 ? 0.5 : 1))
    }
    // sparkles either side at the top of the leap
    const s = t - (TAKEOFF + 0.18)
    if (s >= 0 && s < 0.2 && Math.floor(s / 0.05) % 2 === 0)
      out.push({ x: 1, y: 3, glyph: STAR, color: 'fxLight', alpha: 1 }, { x: 29, y: 2, glyph: STAR, color: 'fxLight', alpha: 1 })
    return out
  },
}
