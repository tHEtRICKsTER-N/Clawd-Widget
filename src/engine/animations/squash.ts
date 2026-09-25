/**
 * A bug crawls in along the grid (lighting the cells it passes, as in Bug Jump), Clawd
 * spots it, leaps over and belly-flops onto it with a thud. ✓ fixed; Clawd strolls back.
 */

import { front } from '../clawd'
import { cellAt } from '../grid'
import { BANG, BUG, BUG_COLOR, CHECK, DOT, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

/** where the bug stops (left edge, sprite px) and when it gets there */
const STOP = -1
const ARRIVE = 1.1
const SPEED = 40
const NOTICE = 0.45
const CROUCH = 1.3
const LEAP = 1.45
const STOMP = 1.9
/** how far left Clawd leaps: its belly lands right on the bug */
const REACH = -15
const HOME = 2.5
const BACK = 3.3
const END = 3.6
const SPLAT = ['.#.#.#.', '#######']

const bugX = (t: number) => STOP - Math.round(SPEED * Math.max(0, ARRIVE - t))

export const squash: AnimationDef = {
  id: 'squash',
  name: 'Bug Squash',
  icon: '🐛',
  description: 'A bug crawls in, Clawd pounces and flattens it: fixed!',
  duration: END,
  loopFrom: 0,
  pose(t) {
    if (t < NOTICE) return pose(front(), { name: 'stand' })
    if (t < NOTICE + 0.3) return pose(front({ eyes: 'wide' }), { name: 'spotted' })
    if (t < CROUCH) return pose(front({ eyes: 'lookL', left: 'up', right: 'up' }), { name: 'ready' })
    if (t < LEAP) return pose(front({ legs: 'crouch', eyes: 'lookL', left: 'down', right: 'down' }), { name: 'crouch' })
    if (t < STOMP) {
      const f = (t - LEAP) / (STOMP - LEAP)
      const h = Math.round(8 * 4 * f * (1 - f))
      // arms up, not high: at the top of the leap raised arms would leave the button
      return pose(front({ legs: 'air', dy: -h, eyes: 'wide', left: 'up', right: 'up' }), { ox: Math.round(REACH * f), name: `leap ${h}` })
    }
    if (t < STOMP + 0.2) return pose(front({ legs: 'crouch', eyes: 'closed', left: 'down', right: 'down' }), { ox: REACH, name: 'stomp' })
    if (t < HOME) return pose(front({ eyes: 'happy', left: 'high', right: 'high' }), { ox: REACH, name: 'fixed' })
    if (t < BACK) {
      // strolls back home
      const f = (t - HOME) / (BACK - HOME)
      const step = Math.floor((t - HOME) / 0.1) % 2
      return pose(front({ legs: step ? 'stepA' : 'stepB', eyes: 'lookR' }), { ox: Math.round(REACH * (1 - f)), name: step ? 'walk-a' : 'walk-b' })
    }
    return pose(front({ eyes: t > 3.45 && t < 3.52 ? 'closed' : 'open' }), { name: 'stand' })
  },
  pulses(t) {
    const ev: PulseEvent[] = []
    // the bug's glowing track: one cell each time its middle crosses into it
    const row = cellAt(0, 23, true).cy
    const stopMid = STOP + BUG[0].length / 2
    for (let c = Math.floor(cellAt(stopMid, 0).cx); c >= 0; c--) {
      const at = ARRIVE - (stopMid - (c * 11 + 5.5 - 548) / 2.9) / SPEED
      if (at < 0) break
      ev.push([at, 'trail', { cx: c + 0.5, cy: row }])
    }
    ev.push([NOTICE, 'twinkle', { strength: 0.8, ...cellAt(31, 4, true) }])
    ev.push([LEAP, 'strum', { strength: 0.4 }])
    ev.push([STOMP, 'land', { strength: 1, ...cellAt(stopMid, 23) }])
    ev.push([STOMP + 0.3, 'twinkle', { strength: 0.9, ...cellAt(1, 4, true) }])
    return scheduled(t, ev, 2400)
  },
  particles(t) {
    const out: Particle[] = []
    if (t < STOMP) {
      // scuttling in; frozen in place once it's spotted, then trembling as Clawd comes down
      const x = bugX(t)
      const legs = t < ARRIVE ? Math.floor(t / 0.1) % 2 : t > LEAP ? Math.floor(t / 0.05) % 2 : 0
      out.push({ x, y: 22, glyph: legs ? [BUG[2], BUG[1], BUG[0]] : BUG, color: BUG_COLOR, alpha: 1 })
    } else if (t < BACK) {
      out.push({ x: STOP - 1, y: 23, glyph: SPLAT, color: BUG_COLOR, alpha: t > BACK - 0.4 ? 0.5 : 1 })
    }
    // bits fly out from under the belly
    const a = t - STOMP
    if (a >= 0 && a < 0.5) {
      for (let k = 0; k < 6; k++) {
        const side = k % 2 ? 1 : -1
        out.push({
          x: 1 + side * (5 + Math.round((14 + hash(k + 950) * 16) * a)),
          y: 22 + Math.round(-(20 + hash(k + 960) * 14) * a + 70 * a * a),
          glyph: DOT,
          color: BUG_COLOR,
          alpha: a > 0.35 ? 0.5 : 1,
        })
      }
    }
    if (t >= NOTICE && t < NOTICE + 0.3) out.push({ x: 30, y: 2, glyph: BANG, color: 'fx', alpha: 1 })
    // ✓ rises over Clawd where it landed
    const c = t - (STOMP + 0.25)
    if (c >= 0 && c < 0.8) out.push({ x: 14 + REACH, y: Math.max(1, 4 - Math.floor(c * 10)), glyph: CHECK, color: 'fx', alpha: c > 0.6 ? 0.5 : 1 })
    return out
  },
}
