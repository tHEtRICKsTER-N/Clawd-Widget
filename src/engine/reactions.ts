/**
 * Reactions: short bits of life that aren't animations you pick, but answers to what the
 * user does with the widget. Like animations they are pure functions of time (seconds since
 * the reaction started); the renderer keeps the state of when each one began.
 *
 *   dangle   while the widget is dragged: lifted, flailing, kicking, leaning against the motion
 *   landing  after it's put down: a short fall, a squashed thud, dust, a shockwave, relief
 */

import { front } from './clawd'
import { DOT, DOT2, type Particle } from './particle'
import { scheduled, type Pulse } from './pulses'
import { pose, type Pose } from './types'

export interface Reaction {
  /** null = no override, the normal idle pose shows */
  pose: Pose | null
  pulses: Pulse[]
  particles: Particle[]
}

/** How far Clawd leans, sprite px: -2 (left) … 2 (right). */
export const MAX_LEAN = 2

/** Carried around. `lean` shifts the body sideways, opposite to how the widget moves. */
export function dangle(t: number, lean: number): Pose {
  const flap = Math.floor(t / 0.12) % 2
  const kick = Math.floor(t / 0.09) % 2
  // surprised to be picked up, then enjoying the ride
  const eyes = t < 0.4 ? 'wide' : 'happy'
  return pose(
    front({ eyes, legs: kick ? 'kickL' : 'kickR', left: flap ? 'high' : 'up', right: flap ? 'up' : 'high', dx: lean, dy: -2 }),
    { name: `dangle ${eyes} ${lean} ${flap}${kick}` },
  )
}

const HIT = 0.06
/** after this the idle pose takes over again; the shockwave keeps fading until LANDING_END */
const POSE_END = 0.5
export const LANDING_END = 1.3

export function landing(a: number): Reaction {
  let p: Pose | null = null
  if (a < HIT) p = pose(front({ legs: 'air', eyes: 'wide', left: 'high', right: 'high', dy: -1 }), { name: 'fall' })
  else if (a < 0.22) p = pose(front({ legs: 'crouch', eyes: 'closed', left: 'up', right: 'up' }), { name: 'thud' })
  else if (a < POSE_END) p = pose(front({ eyes: 'happy' }), { name: 'phew' })
  return {
    pose: p,
    pulses: scheduled(a, [[HIT, 'land', { strength: 0.72 }]], 1200),
    particles: dust(a - HIT),
  }
}

/** Two little puffs kicked out sideways from the feet. */
function dust(d: number): Particle[] {
  if (d < 0 || d > 0.4) return []
  const spread = Math.floor(d * 22)
  const y = 24 - (d < 0.12 ? 0 : 1)
  const glyph = d < 0.2 ? DOT2 : DOT
  const alpha = d > 0.28 ? 0.5 : 0.85
  const out: Particle[] = [
    { x: 6 - spread, y, glyph, color: 'energy', alpha },
    { x: 25 + spread, y, glyph, color: 'energy', alpha },
  ]
  // a smaller, slower second puff just above
  if (d > 0.08 && d < 0.32) {
    const s2 = Math.floor(d * 12)
    out.push({ x: 7 - s2, y: y - 1, glyph: DOT, color: 'energy', alpha: alpha * 0.8 })
    out.push({ x: 25 + s2, y: y - 1, glyph: DOT, color: 'energy', alpha: alpha * 0.8 })
  }
  return out
}
