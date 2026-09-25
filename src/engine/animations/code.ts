/** Hammers away on a laptop; code glyphs stream out and scanlines sweep the grid. */

import { front } from '../clawd'
import { CHECK, CODE_GLYPHS, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

const TYPE_START = 0.25
const ENTER = 3.0
const pausedBlock = (t: number) => hash(Math.floor(t / 0.36) * 7 + 1) > 0.78

export const code: AnimationDef = {
  id: 'code',
  name: 'Code Mode',
  icon: '⌨️',
  description: 'Types furiously, code flies out, hits enter and celebrates',
  duration: 4.1,
  loopFrom: 0,
  pose(t) {
    if (t < TYPE_START) return pose(front({ laptop: true, eyes: 'look', left: 'none', right: 'none' }), { name: 'ready' })
    if (t < ENTER) {
      if (pausedBlock(t)) return pose(front({ laptop: true, eyes: 'lookR', left: 'none', right: 'none' }), { name: 'think' })
      const k = Math.floor(t / 0.09) % 2
      return pose(front({ laptop: true, eyes: 'look', left: 'none', right: 'none', typing: k ? 1 : 2 }), { name: 'type' })
    }
    if (t < 3.45)
      return pose(front({ laptop: true, hands: false, eyes: 'happy', left: 'high', right: 'high', dy: t < 3.2 ? -1 : 0 }), {
        name: 'enter!',
      })
    return pose(front({ laptop: true, eyes: t > 3.8 && t < 3.9 ? 'closed' : 'open', left: 'none', right: 'none' }), { name: 'done' })
  },
  pulses(t) {
    const ev: PulseEvent[] = []
    for (let i = 0; i < 5; i++) ev.push([0.45 + i * 0.5, 'scan', { strength: 0.42 + 0.1 * (i % 2) }])
    ev.push([ENTER, 'first', { strength: 0.95 }])
    return scheduled(t, ev, 700)
  },
  particles(t) {
    const out: Particle[] = []
    for (let k = 0; ; k++) {
      const t0 = 0.3 + k * 0.12
      if (t0 > ENTER - 0.1 || t0 > t) break
      const a = t - t0
      if (a > 0.85 || pausedBlock(t0)) continue
      const g = CODE_GLYPHS[Math.floor(hash(k + 11) * CODE_GLYPHS.length)]
      out.push({
        x: 4 + Math.floor(hash(k + 5) * 3) - Math.floor(a * 30),
        y: 13 + Math.floor(hash(k + 3) * 6) - Math.floor(a * 8),
        glyph: g,
        color: k % 3 === 0 ? 'energy' : 'fx',
        alpha: a > 0.6 ? 0.55 : 0.95,
      })
    }
    const a = t - ENTER
    if (a >= 0 && a < 0.95 && Math.floor(a / 0.12) % 4 !== 3) out.push({ x: 26, y: 2, glyph: CHECK, color: 'fx', alpha: 1 })
    return out
  },
}
