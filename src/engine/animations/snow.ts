/**
 * Seasonal (December to early January): snow drifts down over the button and glints in the
 * grid. Clawd looks up, shuffles about catching flakes on its tongue, gets one, lets snow
 * pile up on its head, then shakes it all off.
 */

import { front } from '../clawd'
import { DOT, HEART_S, STAR, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

const CATCH = 1.9
const SHAKE = 3.1
const END = 4.4
const FLAKES = 24
const WHITE = '#f4f8ff'
/** shuffling to catch flakes: where Clawd stands, from these times */
const SHUFFLE: [number, number][] = [
  [0.8, -2],
  [1.2, 0],
  [1.5, 2],
  [1.8, 0],
]
/** the snow on its head gets wider */
const PILE: [number, number][] = [
  [2.0, 5],
  [2.4, 9],
  [2.8, 13],
]

const shuffleX = (t: number) => SHUFFLE.reduce((x, [at, to]) => (t >= at ? to : x), 0)
const pileW = (t: number) => PILE.reduce((w, [at, n]) => (t >= at ? n : w), 0)

export const snow: AnimationDef = {
  id: 'snow',
  name: 'Snow Day',
  icon: '❄️',
  description: 'Winter: snow falls, Clawd catches flakes and shakes off the snow on its head (December to early January)',
  duration: END,
  loopFrom: 0,
  season: [12, 1, 1, 7],
  pose(t) {
    if (t < 0.5) return pose(front({ gaze: [0, -1] }), { name: 'snow!' })
    if (t < CATCH) {
      const ox = shuffleX(t)
      const moving = SHUFFLE.some(([at]) => t >= at && t < at + 0.1)
      return pose(front({ gaze: [0, -1], mouth: 'open', legs: moving ? 'stepA' : 'stand' }), { ox, name: `catch ${ox}` })
    }
    if (t < SHAKE - 0.2) return pose(front({ eyes: 'happy', mouth: t < CATCH + 0.3 }), { name: 'got one' })
    if (t < SHAKE) return pose(front({ eyes: 'closed', squash: 1 }), { name: 'brace' })
    if (t < SHAKE + 0.3) {
      const k = Math.floor((t - SHAKE) / 0.05) % 2
      return pose(front({ eyes: 'closed', left: 'up', right: 'up' }), { ox: k ? 1 : -1, name: k ? 'shake-r' : 'shake-l' })
    }
    if (t < END - 0.5) return pose(front({ eyes: 'happy' }), { name: 'cozy' })
    return pose(front({ eyes: t > END - 0.2 && t < END - 0.1 ? 'closed' : 'open' }), { name: 'stand' })
  },
  pulses(t) {
    const ev: PulseEvent[] = [[0.1, 'soft', { strength: 0.25 }]]
    // flakes glinting in the grid
    for (let i = 0; i < 12; i++)
      ev.push([0.3 + i * 0.27, 'twinkle', { strength: 0.5, cx: 0.5 + Math.floor(hash(i + 1300) * 60), cy: 0.5 + Math.floor(hash(i + 1400) * 9.5) }])
    ev.push([CATCH, 'soft', { strength: 0.35 }])
    ev.push([SHAKE, 'strum', { strength: 0.5 }])
    return scheduled(t, ev, 3600)
  },
  particles(t) {
    const out: Particle[] = []
    for (let i = 0; i < FLAKES; i++) {
      const a = t - i * 0.13
      if (a < 0) continue
      const x0 = -56 + Math.floor(hash(i + 1500) * 98)
      const y = -3 + Math.round(a * (12 + hash(i + 1600) * 9))
      const x = x0 + Math.round(Math.sin(a * 3 + i) * 1.5)
      // flakes over Clawd land on its head (and pile up there); the rest reach the ground
      const onHead = x >= 6 && x <= 27
      if (y > (onHead ? 8 : 24)) continue
      out.push({ x, y, glyph: i % 4 ? DOT : STAR, color: WHITE, alpha: i % 3 ? 1 : 0.7 })
    }
    // the pile on its head
    const w = pileW(t)
    if (w && t < SHAKE) {
      const braced = t >= SHAKE - 0.2 ? 1 : 0 // the head squashes down a pixel
      out.push({ x: Math.round(16.5 - w / 2), y: 7 + braced, glyph: ['.' + '#'.repeat(w - 2) + '.', '#'.repeat(w)], color: WHITE, alpha: 1 })
    }
    // shaken off
    const a = t - SHAKE
    if (a >= 0 && a < 0.5) {
      for (let k = 0; k < 8; k++) {
        const side = k % 2 ? 1 : -1
        out.push({
          x: 16 + side * (3 + Math.round((12 + hash(k + 1700) * 14) * a)),
          y: 8 + Math.round(-(14 + hash(k + 1710) * 10) * a + 60 * a * a),
          glyph: DOT,
          color: WHITE,
          alpha: a > 0.35 ? 0.5 : 1,
        })
      }
    }
    // caught one
    const c = t - CATCH
    if (c >= 0 && c < 0.7) out.push({ x: 15, y: Math.max(2, 5 - Math.floor(c * 8)), glyph: HEART_S, color: 'c0', alpha: c > 0.5 ? 0.5 : 1 })
    return out
  },
}
