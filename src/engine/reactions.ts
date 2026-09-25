/**
 * Short reactions to what the user does (dragging, dropping, …). The renderer decides
 * when they start; like the animations, what they look like is a pure function of the
 * time since then.
 */

import { front } from './clawd'
import { makePulse, type Pulse } from './pulses'
import { pose, type Pose } from './types'

/** Being dragged: off the ground, legs dangling, arms up, wide eyes, swaying a little. */
export function dangle(t: number): Pose {
  const sway = Math.round(Math.sin(t * Math.PI * 2 * 1.6))
  return pose(front({ legs: 'air', left: 'high', right: 'high', eyes: 'wide', dx: sway, dy: -2 }), { name: `dangle ${sway}` })
}

/** seconds from the drop until Clawd is standing again */
export const DROP = 0.34

/** Just dropped: lands in a crouch with a thud, then straightens up; null once it's over. */
export function drop(t: number): Pose | null {
  if (t < 0.12) return pose(front({ legs: 'crouch', eyes: 'closed', left: 'down', right: 'down' }), { name: 'thud' })
  if (t < DROP) return pose(front({ legs: 'crouch', left: 'up', right: 'up' }), { name: 'thud-up' })
  return null
}

/** The shockwave a drop sends through the grid (a little softer than a Jump Party landing). */
export const dropPulse = (t0: number, seed: number): Pulse => makePulse(t0, 'land', seed, { strength: 0.7 })
