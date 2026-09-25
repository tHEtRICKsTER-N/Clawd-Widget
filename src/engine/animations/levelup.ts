/**
 * Level up: Clawd powers up with sparkles rising around it, flickers between sizes like a
 * certain plumber eating a mushroom, stands big and proud while ↑s rise and "LV UP!" floats
 * beside it, then settles back down.
 */

import { front } from '../clawd'
import { ARROW_UP, STAR, tinyText, tinyWidth, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

const GROW = 0.6
/** the flicker: one size per step */
const FLICKER = [1.12, 1, 1.12, 1, 1.25, 1, 1.12, 1.25]
const STEP = 0.08
const BIG = GROW + FLICKER.length * STEP
const SHRINK = BIG + 1.05
const SETTLE = [1.16, 1.08]
const END = SHRINK + 1.1
const TEXT = 'LV UP!'

export const levelup: AnimationDef = {
  id: 'levelup',
  name: 'Level Up',
  icon: '⬆️',
  description: 'Powers up, flickers bigger like a mushroom just hit, and levels up with a fanfare of arrows',
  duration: END,
  loopFrom: 0,
  pose(t) {
    if (t < GROW) {
      const breath = Math.floor(t / 0.15) % 2
      return pose(front({ eyes: 'closed', left: 'down', right: 'down', squash: breath }), { name: breath ? 'charge-b' : 'charge-a' })
    }
    if (t < BIG) {
      const i = Math.floor((t - GROW) / STEP)
      return pose(front({ eyes: 'wide' }), { scale: FLICKER[i], name: `grow ${FLICKER[i]}` })
    }
    if (t < SHRINK) return pose(front({ eyes: 'happy', left: 'high', right: 'high' }), { scale: 1.25, name: 'big' })
    const i = Math.floor((t - SHRINK) / 0.1)
    if (i < SETTLE.length) return pose(front({ eyes: 'happy' }), { scale: SETTLE[i], name: `settle ${SETTLE[i]}` })
    if (t < END - 0.4) return pose(front({ eyes: 'happy' }), { name: 'proud' })
    return pose(front({ eyes: t > END - 0.25 && t < END - 0.15 ? 'closed' : 'open' }), { name: 'stand' })
  },
  pulses(t) {
    const ev: PulseEvent[] = [
      [0.05, 'soft', { strength: 0.3 }],
      [GROW, 'power', { strength: 0.7 }],
      [BIG, 'first', { strength: 0.95 }],
    ]
    // stars all over the grid
    for (let i = 0; i < 12; i++)
      ev.push([BIG + 0.12 + i * 0.08, 'twinkle', { strength: 0.85, cx: 2.5 + Math.floor(hash(i + 1000) * 58), cy: 0.5 + Math.floor(hash(i + 1100) * 9.5) }])
    return scheduled(t, ev, 3000)
  },
  particles(t) {
    const out: Particle[] = []
    // powering up: sparkles rise either side
    for (let k = 0; k < 8; k++) {
      const a = t - (0.05 + k * 0.07)
      if (a < 0 || a > 0.5) continue
      const x = k % 2 ? 27 + (k % 3) * 2 : 1 + (k % 3) * 2
      out.push({ x, y: 22 - Math.round(a * 40), glyph: STAR, color: 'fxLight', alpha: a > 0.4 ? 0.5 : 1 })
    }
    // stat-up arrows rise on both sides
    for (let k = 0; k < 6; k++) {
      const a = t - (BIG + 0.1 + k * 0.14)
      if (a < 0 || a > 0.8) continue
      const x = [-4, 35, -34, 38, -42, 34][k]
      out.push({ x, y: 22 - Math.round(a * 34), glyph: ARROW_UP, color: (['c0', 'c1', 'c3'] as const)[k % 3], alpha: a > 0.6 ? 0.5 : 1 })
    }
    // "LV UP!" floats up beside Clawd and stays a while
    const u = t - (BIG + 0.15)
    if (u >= 0 && u < 1.8) {
      const w = tinyWidth(TEXT)
      out.push(...tinyText(TEXT, -7 - w, Math.max(7, 12 - Math.floor(u * 20)), 'fx', u > 1.5 ? 0.5 : 1))
    }
    return out
  },
}
