/** Hand up, eyes up and away: a thought bubble grows, dots cycle inside it, the grid breathes slowly. */

import { front } from '../clawd'
import { DOT, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { pose, type AnimationDef } from '../types'

/** the bubble has grown; the rest loops */
const GROWN = 1.0
/** "·", "··", "···", "" inside the bubble, one step at a time */
const DOT_STEP = 0.4

const SMALL = ['##', '##']
const CLOUD = ['.#######.', '#########', '#########', '#########', '.#######.']

export const think: AnimationDef = {
  id: 'think',
  name: 'Thinking',
  icon: '💭',
  description: 'Mulls it over while a thought bubble fills with dots; loops calmly, good for "working"',
  duration: GROWN + 3.2,
  loopFrom: GROWN,
  pose(t) {
    if (t < 0.15) return pose(front(), { name: 'think-start' })
    const u = t < GROWN ? 0 : (t - GROWN) % 3.2
    if (u > 1.6 && u < 1.72) return pose(front({ eyes: 'closed', right: 'up' }), { name: 'think-blink' })
    // looks up at the bubble, now and then straight up
    const gaze: [number, number] = u > 1.72 && u < 2.5 ? [0, -1] : [-1, -1]
    return pose(front({ gaze, right: 'up' }), { name: `think ${gaze}` })
  },
  pulses(t) {
    // a slow, soft glow now and then (this loops for as long as Claude works)
    const ev: PulseEvent[] = [[0.2, 'soft', { strength: 0.24 }]]
    for (let k = 0; k < 2; k++) ev.push([GROWN + 0.4 + k * 1.6, 'soft', { strength: 0.24 }])
    return scheduled(t, ev, 1500)
  },
  particles(t) {
    const out: Particle[] = []
    // rising from the head: a dot, a bigger dot, then the bubble
    if (t >= 0.25) out.push({ x: 8, y: 7, glyph: DOT, color: 'text', alpha: 1 })
    if (t >= 0.5) out.push({ x: 5, y: 5, glyph: SMALL, color: 'text', alpha: 1 })
    if (t >= 0.75) {
      out.push({ x: -2, y: 0, glyph: CLOUD, color: 'text', alpha: 1 })
      const n = t < GROWN ? 0 : Math.floor((t - GROWN) / DOT_STEP) % 4
      for (let i = 0; i < n; i++) out.push({ x: i * 2, y: 2, glyph: DOT, color: 'glow', alpha: 1 })
    }
    return out
  },
}
