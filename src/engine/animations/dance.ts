/** Side-to-side dance on the beat with a hop every bar; notes pop off each step. */

import { front } from '../clawd'
import type { Particle } from '../particle'
import { SPRITE_CENTER, scheduled, type PulseEvent } from '../pulses'
import { NOTE_GLYPHS } from '../sprites'
import { pose, type AnimationDef } from '../types'

const START = 0.2
const BEAT = 0.35
const BEATS = 11
const END = START + BEATS * BEAT

export const dance: AnimationDef = {
  id: 'dance',
  name: 'Dance Party',
  icon: '🕺',
  description: 'Grooves left and right on the beat, hops every bar',
  duration: END + 0.5,
  loopFrom: 0,
  pose(t) {
    if (t < START) return pose(front(), { name: 'ready' })
    const x = (t - START) / BEAT
    const b = Math.floor(x)
    if (b >= BEATS) return pose(front({ eyes: 'happy', left: 'high', right: 'high' }), { name: 'finale' })
    const f = x - b
    const hop = b % 4 === 3
    const even = b % 2 === 0
    const airborne = hop && f >= 0.15 && f < 0.55
    return pose(
      front({
        legs: f < 0.15 ? 'crouch' : airborne ? 'air' : 'stand',
        dy: airborne ? -3 : 0,
        dx: hop ? 0 : even ? -2 : 2,
        left: hop || even ? 'high' : 'down',
        right: hop || !even ? 'high' : 'down',
        eyes: f < 0.35 ? 'happy' : 'open',
      }),
      { name: hop ? 'hop' : even ? 'left' : 'right' },
    )
  },
  pulses(t) {
    const ev: PulseEvent[] = []
    for (let i = 0; i < BEATS; i++) {
      const bar = i % 4 === 0
      ev.push([START + i * BEAT, bar ? 'power' : 'strum', { strength: bar ? 0.78 : 0.5, cx: SPRITE_CENTER.cx + (i % 2 ? 0.6 : -0.6) }])
    }
    ev.push([END, 'land'])
    return scheduled(t, ev, 800)
  },
  particles(t) {
    const out: Particle[] = []
    for (let i = 0; i < BEATS; i++) {
      const a = t - (START + i * BEAT)
      if (a < 0 || a > 0.75) continue
      const left = i % 2 === 0
      out.push({
        x: (left ? 1 : 30) + (left ? -1 : 1) * Math.floor(a * 5),
        y: 10 - Math.floor(a * 13),
        glyph: NOTE_GLYPHS[i % NOTE_GLYPHS.length],
        color: 'fx',
        top: 'fxLight',
        alpha: a > 0.55 ? 0.6 : 1,
      })
    }
    return out
  },
}
