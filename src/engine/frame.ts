/**
 * What an animation shows at a given play-clock time. This is the one place that knows
 * about loop sections, pulses carried across a loop seam and pulses fading out after a
 * play ends. The renderer draws these; `npm run check:anims` fingerprints them.
 */

import { loopTime } from './animations'
import type { Particle } from './particle'
import type { Pulse } from './pulses'
import type { AnimationDef, Pose } from './types'

/** seconds that pulses keep fading after a play stops or wraps around */
export const LINGER = 1.3

export interface Frame {
  pose: Pose
  pulses: Pulse[]
  particles: Particle[]
  /** clock the pulses are evaluated on (the animation's own clock) */
  fieldT: number
}

/** Frame of a play at play-clock time t (keeps looping past the end). */
export function playFrame(anim: AnimationDef, t: number): Frame {
  const tt = loopTime(anim, t)
  let pulses = anim.pulses(tt)
  // carry pulses that are still fading across a loop seam (shifted onto this iteration's clock)
  const span = anim.duration - anim.loopFrom
  if (!anim.native && t >= anim.duration && tt - anim.loopFrom < LINGER) {
    const late = anim.pulses(tt + span).filter((p) => p.t0 <= anim.duration && p.t0 >= anim.loopFrom)
    pulses = pulses.concat(late.map((p) => ({ ...p, t0: p.t0 - span })))
  }
  return { pose: anim.pose(tt), pulses, particles: anim.particles(tt), fieldT: tt }
}

/** Pulses still fading `after` seconds after a play stopped at `end`; null once they're gone. */
export function lingerFrame(anim: AnimationDef, end: number, after: number): { pulses: Pulse[]; fieldT: number } | null {
  if (after > LINGER) return null
  const fieldT = end + after
  return { pulses: anim.pulses(fieldT).filter((p) => p.t0 <= end), fieldT }
}
