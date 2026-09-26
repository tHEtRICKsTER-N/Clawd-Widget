/**
 * Things Clawd does on its own while resting: now and then a stretch, a yawn, a scratch,
 * a little wander, a sneeze, a whistle, a look around or a hop, and after a long while
 * alone it dozes off. Like the animations,
 * each is a pure function of the time since it started; ClawdLife (core/life.ts)
 * decides when.
 */

import { front } from './clawd'
import { CELL, cellAt } from './grid'
import { BANG, DOT, Z_L, Z_M, type Particle } from './particle'
import { makePulse, scheduled, type Pulse } from './pulses'
import { SPRITE_ORIGIN, SPRITE_UNIT } from './sprites'
import { pose, type Pose } from './types'

export interface Act {
  /** seconds (Infinity: until something ends it) */
  duration: number
  pose(t: number): Pose
  pulses(t: number): Pulse[]
  particles(t: number): Particle[]
}

const none = () => []

// ───────────────────────── antics ─────────────────────────

/** Arms up, eyes shut, stretching a couple of pixels taller. */
export const stretch: Act = {
  duration: 1.6,
  pose(t) {
    if (t < 0.25) return pose(front({ eyes: 'closed', left: 'up', right: 'up' }), { name: 'stretch-1' })
    if (t < 0.45) return pose(front({ eyes: 'closed', left: 'high', right: 'high', squash: -1 }), { name: 'stretch-2' })
    if (t < 1.2) return pose(front({ eyes: 'closed', left: 'high', right: 'high', squash: -2 }), { name: 'stretch-3' })
    if (t < 1.4) return pose(front({ eyes: 'closed', left: 'up', right: 'up' }), { name: 'stretch-4' })
    return pose(front({ eyes: 'happy' }), { name: 'stretch-5' })
  },
  pulses: (t) => scheduled(t, [[0.45, 'soft']], 1100),
  particles: none,
}

/** A big yawn: eyes shut, mouth wide open, a slow breath in. */
export const yawn: Act = {
  duration: 1.9,
  pose(t) {
    if (t < 0.3) return pose(front({ eyes: 'closed', mouth: true }), { name: 'yawn-1' })
    if (t < 1.3) return pose(front({ eyes: 'closed', mouth: 'open', squash: -1 }), { name: 'yawn-2' })
    if (t < 1.5) return pose(front({ eyes: 'closed' }), { name: 'yawn-3' })
    return pose(front(), { name: 'yawn-4' })
  },
  pulses: none,
  particles: none,
}

/** Scratches its head, eyes squeezed happily shut. */
export const scratch: Act = {
  duration: 1.7,
  pose(t) {
    if (t < 0.2) return pose(front({ eyes: 'lookR', right: 'up' }), { name: 'scratch-lift' })
    if (t < 1.4) {
      const k = Math.floor((t - 0.2) / 0.1) % 2
      return pose(front({ eyes: 'happy', right: k ? 'up' : 'high' }), { name: k ? 'scratch-down' : 'scratch-up' })
    }
    return pose(front(), { name: 'scratch-done' })
  },
  pulses: none,
  particles: none,
}

const FAR = 56 // sprite px it wanders to the left
const PACE = 24 // sprite px per second
const STEP = 0.15 // seconds per step
const OUT = 0.35 // starts walking
const WALK = FAR / PACE
const BACK = OUT + WALK + 0.9 // turns back

/** Horizontal offset (sprite px, ≤ 0) of the wander at time t. */
function wanderX(t: number): number {
  if (t < OUT) return 0
  if (t < OUT + WALK) return -Math.round((t - OUT) * PACE)
  if (t < BACK) return -FAR
  if (t < BACK + WALK) return -FAR + Math.round((t - BACK) * PACE)
  return 0
}
const walking = (t: number) => (t >= OUT && t < OUT + WALK) || (t >= BACK && t < BACK + WALK)

/** Wanders off to the left, looks around, and walks back. The grid glows under its feet. */
export const wander: Act = {
  duration: BACK + WALK + 0.35,
  pose(t) {
    const ox = wanderX(t)
    if (walking(t)) {
      const legs = Math.floor(t / STEP) % 2 ? 'stepA' : 'stepB'
      const eyes = t < BACK ? 'lookL' : 'lookR'
      return pose(front({ legs, eyes }), { ox, name: `walk ${ox}` })
    }
    if (t < OUT) return pose(front({ eyes: 'lookL' }), { name: 'wander-look' })
    if (t < BACK) {
      // at the far end: looks around
      const u = t - OUT - WALK
      const eyes = u < 0.3 ? 'lookL' : u < 0.5 ? 'open' : 'lookR'
      return pose(front({ eyes }), { ox, name: `wander-${eyes}` })
    }
    return pose(front(), { name: 'wander-home' })
  },
  pulses(t) {
    // a faint cell lights up under Clawd on every other step
    const out: Pulse[] = []
    for (let k = 0; ; k++) {
      const t0 = OUT + k * STEP * 2
      if (t0 > t) break
      if (!walking(t0) || t - t0 > 0.8) continue
      const cx = (SPRITE_ORIGIN.x + (16.5 + wanderX(t0)) * SPRITE_UNIT) / CELL
      const cy = (SPRITE_ORIGIN.y + 24 * SPRITE_UNIT) / CELL
      out.push(makePulse(t0, 'twinkle', 1200 + k, { strength: 0.38 }, { cx, cy }))
    }
    return out
  },
  particles: none,
}

/** Nose tickle, a big "ah… ah…", CHOO! with a jolt and a little spray, then a dazed blink. */
export const sneeze: Act = {
  duration: 1.9,
  pose(t) {
    if (t < 0.35) return pose(front({ eyes: 'closed', mouth: true, squash: -1 }), { name: 'ah-1' })
    if (t < 0.7) return pose(front({ eyes: 'closed', mouth: 'open', squash: -2, left: 'up', right: 'up' }), { name: 'ah-2' })
    if (t < 0.95) return pose(front({ eyes: 'closed', mouth: true, legs: 'crouch', left: 'down', right: 'down' }), { name: 'choo' })
    if (t < 1.5) return pose(front({ eyes: t > 1.25 && t < 1.32 ? 'closed' : 'wide' }), { name: 'dazed' })
    return pose(front({ eyes: 'happy' }), { name: 'bless-you' })
  },
  pulses: (t) => scheduled(t, [[0.7, 'land', { strength: 0.4 }]], 1500),
  particles(t) {
    const a = t - 0.7
    if (a < 0 || a > 0.45) return []
    // a fine spray bursting out past both sides of the body
    const out: Particle[] = []
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1
      out.push({ x: 16 + side * (11 + Math.round((10 + k * 3) * a)), y: 15 + (k % 3) + Math.round(20 * a * a), glyph: DOT, color: 'text', alpha: a > 0.3 ? 0.5 : 0.9 })
    }
    return out
  },
}

const NOTE = ['.##', '.#.', '.#.', '##.', '##.']
const NOTES = [0.3, 1.0, 1.7]

/** Whistles a little tune, looking innocently about, while notes float up. */
export const whistle: Act = {
  duration: 2.7,
  pose(t) {
    if (t < 2.4) return pose(front({ gaze: t < 1.2 ? [1, -1] : [-1, -1], mouth: true }), { name: t < 1.2 ? 'whistle-r' : 'whistle-l' })
    return pose(front(), { name: 'whistle-done' })
  },
  // each note lights the cell where it appears (and blips, with sound on)
  pulses: (t) => scheduled(t, NOTES.map((n): [number, 'twinkle', { strength: number; cx: number; cy: number }] => [n, 'twinkle', { strength: 0.5, ...cellAt(30, 13, true) }]), 1600),
  particles(t) {
    const out: Particle[] = []
    for (const n of NOTES) {
      const a = t - n
      if (a < 0 || a > 1) continue
      out.push({ x: 29 + Math.round(a * 6), y: 11 - Math.round(a * 10), glyph: NOTE, color: 'fx', alpha: a > 0.75 ? 0.5 : 1 })
    }
    return out
  },
}

const HUH = ['###', '..#', '.##', '...', '.#.']

/** Shades its eyes and looks left, then right, then up, and gives up with a shrug. */
export const lookAround: Act = {
  duration: 2.5,
  pose(t) {
    if (t < 0.9) return pose(front({ eyes: 'lookL', right: 'up' }), { ox: t < 0.2 ? 0 : -1, name: 'look-left' })
    if (t < 1.1) return pose(front(), { name: 'look-mid' })
    if (t < 1.8) return pose(front({ eyes: 'lookR', left: 'up' }), { ox: 1, name: 'look-right' })
    if (t < 2.1) return pose(front({ gaze: [0, -1] }), { name: 'look-up' })
    if (t < 2.35) return pose(front({ eyes: 'closed', left: 'up', right: 'up' }), { name: 'shrug' })
    return pose(front(), { name: 'look-done' })
  },
  pulses: none,
  particles: (t) => (t >= 1.8 && t < 2.35 ? [{ x: 15, y: 2, glyph: HUH, color: 'fx', alpha: 1 }] : []),
}

const HOPS: [start: number, height: number][] = [
  [0.1, 3],
  [0.75, 2],
]
const HOP_AIR = 0.3

/** Two happy little hops in place, each landing with a soft bump in the grid. */
export const hop: Act = {
  duration: 1.5,
  pose(t) {
    for (const [at, h] of HOPS) {
      const u = t - at
      if (u < 0 || u > 0.12 + HOP_AIR + 0.12) continue
      if (u < 0.12) return pose(front({ legs: 'crouch', eyes: 'happy' }), { name: 'hop-crouch' })
      if (u < 0.12 + HOP_AIR) {
        const f = (u - 0.12) / HOP_AIR
        const dy = Math.round(h * 4 * f * (1 - f))
        return pose(front({ legs: 'air', dy: -dy, eyes: 'happy', left: 'up', right: 'up' }), { name: `hop ${dy}` })
      }
      return pose(front({ legs: 'crouch', eyes: 'happy' }), { name: 'hop-land' })
    }
    return pose(front({ eyes: t > 1.2 ? 'open' : 'happy' }), { name: 'hop-rest' })
  },
  pulses: (t) => scheduled(t, HOPS.map(([at], i): [number, 'land', { strength: number }] => [at + 0.12 + HOP_AIR, 'land', { strength: i ? 0.25 : 0.32 }]), 1700),
  particles: none,
}

export const ANTICS = { stretch, yawn, scratch, wander, sneeze, whistle, lookAround, hop }
export type AnticId = keyof typeof ANTICS

// ───────────────────────── dozing ─────────────────────────

const NOD = 1.5 // seconds of nodding off before it's asleep
const ZZZ = 1.8 // one Z every this many seconds
const GLOW = 3.6 // one slow breathing glow every this many seconds

/** Nods off with a yawn, then sleeps: slow breathing, rising Zzz, a soft glow. Never ends by itself. */
export const doze: Act = {
  duration: Infinity,
  pose(t) {
    if (t < NOD) return pose(front({ eyes: 'closed', mouth: t < 1.1 ? 'open' : undefined }), { name: 'nod-off' })
    const out = Math.floor((t - NOD) / 0.9) % 2
    return pose(front({ eyes: 'closed', left: 'down', right: 'down', squash: out }), { name: out ? 'doze-out' : 'doze-in' })
  },
  pulses(t) {
    if (t < NOD) return []
    const k = Math.floor((t - NOD) / GLOW)
    const out: Pulse[] = []
    for (const n of [k - 1, k]) if (n >= 0) out.push(makePulse(NOD + n * GLOW, 'soft', 1300 + (n % 16)))
    return out
  },
  particles(t) {
    if (t < NOD) return []
    const a = (t - NOD) % ZZZ
    if (a > 1.4) return []
    return [{ x: 25 + Math.floor(a * 6), y: 8 - Math.floor(a * 8), glyph: a < 0.7 ? Z_M : Z_L, color: 'fx', alpha: a > 1.1 ? 0.55 : 1 }]
  },
}

/** Woken up: a startled jump with a "!", then wide awake with a blink. */
export const wake: Act = {
  duration: 0.7,
  pose(t) {
    if (t < 0.2) return pose(front({ eyes: 'wide', left: 'high', right: 'high', legs: 'air', dy: -2 }), { name: 'startle' })
    return pose(front({ eyes: t > 0.45 && t < 0.52 ? 'closed' : 'wide' }), { name: 'awake' })
  },
  pulses: (t) => scheduled(t, [[0, 'strum', { strength: 0.4 }]], 1400),
  particles: (t) => (t < 0.5 ? [{ x: 30, y: 2, glyph: BANG, color: 'fx', alpha: 1 }] : []),
}
