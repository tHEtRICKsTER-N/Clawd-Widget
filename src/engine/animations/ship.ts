/**
 * A little rocket drops in beside Clawd and a countdown ticks over its head. On liftoff the
 * rocket climbs, turns and streaks left across the whole button, drawing a glowing trail
 * through the grid; a boom at the far end, and Clawd cheers.
 */

import { front } from '../clawd'
import { cellAt } from '../grid'
import { CHECK, DOT, tinyText, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { hash } from '../rand'
import { pose, type AnimationDef } from '../types'

/** the rocket has landed beside Clawd */
const LANDED = 0.3
/** "3", "2", "1" appear at these times */
const COUNT = [0.55, 0.95, 1.35]
const LIFT = 1.75
/** it has climbed and turns to fly left */
const TURN = LIFT + 0.4
/** it has left the button; the boom */
const BOOM = TURN + 0.95
const END = BOOM + 1.1

/** standing rocket: top-left corner, sprite px */
const RX = -6
const RY = 17
const ROCKET_V = ['..#..', '.###.', '.###.', '.###.', '.###.', '.###.', '#####', '#.#.#']
const NOSE_V = ['..#..', '.###.']
const FLAME_V = [
  ['###', '.#.'],
  ['###', '###', '.#.'],
]
/** flying left, nose first */
const ROCKET_H = ['..####.#', '.#######', '########', '.#######', '..####.#']
const NOSE_H = ['.#', '##', '.#']
const FLAME_H = [
  ['#.', '##', '#.'],
  ['##.', '###', '##.'],
]
/** flight row (top of the flying rocket) and how far left it gets: x = FX − 50u − 170u² */
const FY = 5
const FX = RX - 2
const PUFF = ['##', '##']

const climbY = (u: number) => RY - Math.round(70 * u * u)
const flyX = (u: number) => FX - Math.round(50 * u + 170 * u * u)
/** seconds into the flight when the rocket's tail passes sprite x */
const flyTime = (x: number) => Math.max(0, (-50 + Math.sqrt(Math.max(0, 2500 + 680 * (FX - x)))) / 340)

export const ship: AnimationDef = {
  id: 'ship',
  name: 'Ship It',
  icon: '🚀',
  description: 'Counts down and launches a rocket that streaks across the button, trail and all',
  duration: END,
  loopFrom: 0,
  pose(t) {
    if (t < LANDED) return pose(front({ gaze: [-1, -1] }), { name: 'watch-drop' })
    if (t < COUNT[0]) return pose(front({ eyes: 'happy' }), { name: 'ooh' })
    if (t < LIFT) {
      // nods along with the count, pointing at the rocket
      const nod = COUNT.some((c) => t >= c && t < c + 0.12)
      return pose(front({ eyes: 'lookL', left: 'up', squash: nod ? 1 : 0 }), { name: nod ? 'count-nod' : 'count' })
    }
    if (t < LIFT + 0.35) return pose(front({ legs: 'crouch', eyes: 'closed', left: 'up', right: 'up' }), { name: 'brace' })
    if (t < TURN + 0.15) return pose(front({ gaze: [-1, -1] }), { name: 'watch-climb' })
    if (t < BOOM) return pose(front({ eyes: 'lookL' }), { name: 'watch-fly' })
    if (t < BOOM + 0.8) {
      const k = Math.floor((t - BOOM) / 0.2) % 2
      return pose(front({ eyes: 'happy', left: k ? 'high' : 'up', right: k ? 'up' : 'high' }), { name: k ? 'cheer-l' : 'cheer-r' })
    }
    return pose(front({ eyes: t > END - 0.2 && t < END - 0.1 ? 'closed' : 'open' }), { name: 'shipped' })
  },
  pulses(t) {
    const base = cellAt(RX + 2, 24, true)
    const ev: PulseEvent[] = [[LANDED, 'land', { strength: 0.45, ...base }]]
    // a beep for every count
    COUNT.forEach((c, i) => ev.push([c, 'twinkle', { strength: 0.8, ...cellAt(16 + i, 3, true) }]))
    ev.push([LIFT, 'first', { strength: 0.85, ...base }])
    // the exhaust lights every cell it passes: straight up, then all the way left
    for (let r = Math.floor(base.cy) - 1; r >= 1; r--) {
      const y = (r * 11 + 5.5 - 1.8) / 2.9 // sprite y of this row's middle
      const u = Math.sqrt(Math.max(0, RY + ROCKET_V.length - y) / 70)
      if (u < TURN - LIFT) ev.push([LIFT + u, 'trail', { strength: 0.5, cx: base.cx, cy: r + 0.5 }])
    }
    const row = cellAt(0, FY + 2, true).cy
    for (let c = Math.floor(cellAt(FX + 8, 0).cx); c >= 0; c--) {
      const x = (c * 11 + 5.5 - 548) / 2.9 - ROCKET_H[0].length
      ev.push([TURN + flyTime(x), 'trail', { strength: 0.55, cx: c + 0.5, cy: row }])
    }
    ev.push([TURN, 'scan', { strength: 0.45, cx: base.cx, cy: row }])
    ev.push([BOOM, 'power', { strength: 0.8, cx: 1.5, cy: row }])
    for (let i = 0; i < 8; i++)
      ev.push([BOOM + 0.15 + i * 0.07, 'twinkle', { strength: 0.8, cx: 0.5 + Math.floor(hash(i + 700) * 14), cy: 0.5 + Math.floor(hash(i + 800) * 9.5) }])
    return scheduled(t, ev, 1800)
  },
  particles(t) {
    const out: Particle[] = []
    const flame = Math.floor(t / 0.05) % 2
    if (t < LIFT) {
      // dropped in from above, then standing by
      const y = t < LANDED ? -12 + Math.round(29 * (t / LANDED) ** 2) : RY
      rocketV(out, RX, y)
      COUNT.forEach((c, n) => t >= c && t < c + 0.32 && out.push(...tinyText(String(3 - n), 15, 2, 'fx')))
    } else if (t < TURN) {
      const y = climbY(t - LIFT)
      rocketV(out, RX, y)
      out.push({ x: RX + 1, y: y + ROCKET_V.length, glyph: FLAME_V[flame], color: 'fx', top: 'fxLight', alpha: 1 })
    } else if (t < BOOM) {
      const x = flyX(t - TURN)
      out.push({ x, y: FY, glyph: ROCKET_H, color: 'text', alpha: 1 })
      out.push({ x, y: FY + 1, glyph: NOSE_H, color: 'fx', alpha: 1 })
      out.push({ x: x + 4, y: FY + 2, glyph: DOT, color: 'glow', alpha: 1 })
      out.push({ x: x + ROCKET_H[0].length, y: FY + 1, glyph: FLAME_H[flame], color: 'fx', alpha: 1 })
    }
    // smoke rolls out both ways along the ground at liftoff
    const a = t - LIFT
    if (a >= 0 && a < 0.8) {
      for (let k = 0; k < 6; k++) {
        const side = k % 2 ? 1 : -1
        const d = 3 + Math.round((10 + hash(k + 900) * 12) * a)
        out.push({ x: RX + 1 + side * d, y: 23 - Math.round(a * (2 + (k % 3))), glyph: PUFF, color: 'dim', alpha: a > 0.5 ? 0.5 : 0.9 })
      }
    }
    // shipped: a ✓ rises over Clawd
    const c = t - (BOOM + 0.1)
    if (c >= 0 && c < 0.9) out.push({ x: 14, y: Math.max(1, 4 - Math.floor(c * 10)), glyph: CHECK, color: 'fx', alpha: c > 0.7 ? 0.5 : 1 })
    return out
  },
}

function rocketV(out: Particle[], x: number, y: number) {
  out.push({ x, y, glyph: ROCKET_V, color: 'text', alpha: 1 })
  out.push({ x, y, glyph: NOSE_V, color: 'fx', alpha: 1 })
  out.push({ x: x + 2, y: y + 3, glyph: DOT, color: 'glow', alpha: 1 })
}
