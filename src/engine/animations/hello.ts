/** Waves hello, sends hearts, finishes with a little cheer-hop. */

import { front } from '../clawd'
import { HEART, HEART_S, type Particle } from '../particle'
import { scheduled } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

const WAVE_START = 0.3
const WAVE_END = 2.3
const LAND = 2.56
const HEARTS = [0.3, 0.62, 0.95, 1.28, 1.6, 1.94]

export const hello: AnimationDef = {
  id: 'hello',
  name: 'Hello Wave',
  icon: '👋',
  description: 'Waves hello and sends a few hearts',
  duration: 3.3,
  loopFrom: 0,
  pose(t) {
    if (t < 0.12) return pose(front({ legs: 'crouch', eyes: 'happy' }), { name: 'squash' })
    if (t < WAVE_START) return pose(front({ right: 'up' }), { name: 'lift' })
    if (t < WAVE_END) {
      const k = Math.floor((t - WAVE_START) / 0.16) % 2
      return pose(front({ eyes: 'happy', right: k ? 'up' : 'high' }), { name: k ? 'wave-down' : 'wave-up' })
    }
    if (t < 2.52) return pose(front({ eyes: 'happy', left: 'high', right: 'high', legs: 'air', dy: -3 }), { name: 'cheer' })
    if (t < 2.66) return pose(front({ eyes: 'happy', left: 'up', right: 'up', legs: 'crouch' }), { name: 'land' })
    const blink = t > 3.0 && t < 3.1
    return pose(front({ eyes: blink ? 'closed' : 'open' }), { name: 'rest' })
  },
  pulses: (t) =>
    scheduled(
      t,
      [
        [0.3, 'sway', { strength: 0.52 }],
        [0.95, 'sway', { strength: 0.52 }],
        [1.6, 'sway', { strength: 0.58 }],
        [2.3, 'strum', { strength: 0.45 }],
        [LAND, 'land'],
      ],
      500,
    ),
  particles(t) {
    const out: Particle[] = []
    HEARTS.forEach((t0, i) => {
      const a = t - t0
      if (a < 0 || a > 0.75) return
      const bob = Math.floor(a / 0.12) % 2
      out.push({
        x: 27 + Math.floor(a * 12) + (i % 2),
        y: 5 - Math.floor(a * 7) + bob,
        glyph: i % 2 ? HEART_S : HEART,
        color: i % 3 === 2 ? 'fxAlt' : 'fx',
        alpha: a > 0.55 ? 0.6 : 1,
      })
    })
    // burst of hearts on landing
    const a = t - LAND
    if (a >= 0 && a < 0.8) {
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI * (1.08 + 0.84 * (k / 5)) + (hash(k + 40) - 0.5) * 0.3
        const sp = 24 + hash(k + 70) * 12
        out.push({
          x: 16 + Math.round(Math.cos(ang) * sp * a),
          y: 3 + Math.round(Math.sin(ang) * sp * 0.6 * a + 12 * a * a),
          glyph: k % 2 ? HEART_S : HEART,
          color: k % 3 === 1 ? 'fxAlt' : 'fx',
          alpha: a > 0.6 ? 0.55 : 1,
        })
      }
    }
    return out
  },
}
