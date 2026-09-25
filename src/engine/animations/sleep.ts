/** Dozes off: slow breathing glow, twinkling cells, rising Zzz — then startles awake. */

import { front } from '../clawd'
import { BANG, Z_L, Z_M, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

const WAKE = 4.0
const ZS = [0.35, 1.25, 2.15, 3.05]

export const sleep: AnimationDef = {
  id: 'sleep',
  name: 'Sleepy',
  icon: '💤',
  description: 'Snoozes with a breathing glow and Zzz, then wakes with a start',
  duration: 4.7,
  loopFrom: 0,
  pose(t) {
    if (t < WAKE) {
      const out = Math.floor(t / 0.9) % 2
      return pose(front({ eyes: 'closed', left: 'down', right: 'down', squash: out }), { name: out ? 'exhale' : 'inhale' })
    }
    if (t < 4.18) return pose(front({ eyes: 'wide', left: 'high', right: 'high', legs: 'air', dy: -2 }), { name: 'startle' })
    return pose(front({ eyes: t > 4.45 && t < 4.55 ? 'closed' : 'wide' }), { name: 'awake' })
  },
  pulses(t) {
    const ev: PulseEvent[] = [
      [0.1, 'soft'],
      [1.9, 'soft'],
    ]
    for (let i = 0; i < 16; i++)
      ev.push([0.3 + i * 0.22, 'twinkle', { cx: 2.5 + Math.floor(hash(i + 20) * 44), cy: 0.5 + Math.floor(hash(i + 90) * 9.5) }])
    ev.push([WAKE, 'strum', { strength: 0.72 }])
    return scheduled(t, ev, 900)
  },
  particles(t) {
    const out: Particle[] = []
    for (const t0 of ZS) {
      const a = t - t0
      if (a < 0 || a > 1.4 || t > WAKE) continue
      out.push({
        x: 25 + Math.floor(a * 6),
        y: 8 - Math.floor(a * 8),
        glyph: a < 0.7 ? Z_M : Z_L,
        color: 'fx',
        alpha: a > 1.1 ? 0.55 : 1,
      })
    }
    const a = t - WAKE
    if (a >= 0 && a < 0.5) out.push({ x: 30, y: 2, glyph: BANG, color: 'fx', alpha: 1 })
    return out
  },
}
