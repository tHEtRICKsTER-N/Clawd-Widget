/**
 * Short reactions to what the user does (dragging, dropping, …). The renderer decides
 * when they start; like the animations, what they look like is a pure function of the
 * time since then.
 */

import { front } from './clawd'
import { BANG, DOT, DOT2, HEART_S, STAR, tinyText, tinyWidth, type Particle } from './particle'
import { makePulse, type Pulse } from './pulses'
import { hash } from './rand'
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

// ───────────────────────── pokes ─────────────────────────

/** seconds a poke's squish lasts */
export const POKE = 0.26
/** a poke within this many seconds of the last one keeps the combo going */
export const COMBO_WINDOW = 0.8
/** seconds a heart floats */
export const HEART_LIFE = 0.75
/** every this many pokes in a combo, Clawd celebrates */
export const CELEBRATE_EVERY = 10
/** a celebration's hop: take-off and landing, seconds from its start */
const HOP = 0.1
const LAND = 0.45

/** Poked: squished flat with a flinch, then a happy bounce back; null once it's over. */
export function poke(t: number): Pose | null {
  if (t < 0.08) return pose(front({ squash: 2, eyes: 'closed', left: 'up', right: 'up' }), { name: 'poke' })
  if (t < POKE) return pose(front({ squash: 1, eyes: 'happy' }), { name: 'poke-up' })
  return null
}

/** The ring a poke sends out; it grows with the combo (n = 1, 2, …). */
export const pokePulse = (t0: number, n: number, seed: number): Pulse =>
  makePulse(t0, 'strum', seed, { strength: Math.min(0.8, 0.3 + 0.05 * (n - 1)) })

/** A small heart floating up and away from Clawd's head, to the left or right; null once gone. */
export function pokeHeart(age: number, seed: number): Particle | null {
  if (age < 0 || age > HEART_LIFE) return null
  const right = hash(seed) < 0.6
  const drift = Math.floor(age * 10)
  const bob = Math.floor(age / 0.12) % 2
  return {
    x: right ? 22 + drift : 8 - drift,
    y: 6 - Math.floor(age * 9) + bob,
    glyph: HEART_S,
    color: seed % 3 === 2 ? 'fxAlt' : 'fx',
    alpha: age > 0.55 ? 0.6 : 1,
  }
}

/**
 * The combo counter over Clawd's head ("x5!"), from the second poke on. `since` is the
 * time since the latest poke: it hops on each hit and fades once the combo has lapsed.
 * `celebrating` is the time into a celebration, whose hop would jump into the text.
 */
export function comboText(n: number, since: number, celebrating = Infinity): Particle[] {
  if (n < 2 || since < 0 || (celebrating >= HOP && celebrating < LAND)) return []
  const fading = since - COMBO_WINDOW
  if (fading > 0.5) return []
  const s = `x${n}!`
  return tinyText(s, Math.round(16.5 - tinyWidth(s) / 2), since < 0.08 ? 0 : 1, 'fx', fading > 0.2 ? 0.5 : 1)
}

// ───────────────────────── celebration ─────────────────────────

/** seconds from the start of a celebration to its end (confetti included) */
export const CELEBRATE = 1.35

/** Combo milestone: crouch, a big cheering hop, landing, arms up; null once it's over. */
export function celebrate(t: number): Pose | null {
  if (t < HOP) return pose(front({ legs: 'crouch', eyes: 'happy', left: 'down', right: 'down' }), { name: 'cheer-crouch' })
  if (t < LAND) {
    const f = (t - HOP) / (LAND - HOP)
    const h = Math.round(6 * 4 * f * (1 - f))
    return pose(front({ legs: 'air', dy: -h, eyes: 'happy', left: 'high', right: 'high' }), { name: `cheer ${h}` })
  }
  if (t < LAND + 0.14) return pose(front({ legs: 'crouch', eyes: 'happy', left: 'up', right: 'up' }), { name: 'cheer-land' })
  if (t < 1.0) return pose(front({ eyes: 'happy', left: 'high', right: 'high' }), { name: 'yay' })
  return null
}

/** Pulses of a celebration that starts at t0: a ring on take-off, a full shockwave on landing. */
export const celebratePulses = (t0: number, seed: number): Pulse[] => [
  makePulse(t0 + HOP, 'strum', seed, { strength: 0.45 }),
  makePulse(t0 + LAND, 'land', seed + 1, { strength: 1 }),
]

const PIECES: string[][] = [DOT, DOT2, ['#', '#'], ['#.', '.#']]

/** Sparkles at the top of the hop, then two fountains of confetti from the landing. */
export function celebrateParticles(t: number, seed: number): Particle[] {
  const out: Particle[] = []
  const s = t - (HOP + 0.12)
  if (s >= 0 && s < 0.2 && Math.floor(s / 0.05) % 2 === 0) {
    out.push({ x: 2, y: 4, glyph: STAR, color: 'fxLight', alpha: 1 }, { x: 28, y: 3, glyph: STAR, color: 'fxLight', alpha: 1 })
  }
  const a = t - LAND
  if (a < 0 || a > 0.9) return out
  for (let k = 0; k < 14; k++) {
    const h = seed * 31 + k
    const right = k % 2 === 1
    const ang = right ? -Math.PI * (0.1 + 0.35 * hash(h)) : -Math.PI * (0.55 + 0.35 * hash(h))
    const sp = 24 + hash(h + 7) * 18
    out.push({
      x: (right ? 26 : 6) + Math.round(Math.cos(ang) * sp * a),
      y: 22 + Math.round(Math.sin(ang) * sp * a + 0.5 * 58 * a * a),
      glyph: PIECES[k % PIECES.length],
      color: (['c0', 'c1', 'c2', 'c3'] as const)[k % 4],
      alpha: a > 0.65 ? 0.6 : 1,
    })
  }
  return out
}

// ───────────────────────── status ─────────────────────────

/** seconds per bob of the waiting badge */
export const BADGE_BOB = 0.6

/** "!" over Clawd's head while it waits for you (e.g. Claude Code needs input); `still` under reduced motion. */
export function waitingBadge(t: number, still = false): Particle {
  const bob = still ? 0 : Math.floor(t / BADGE_BOB) % 2
  return { x: 30, y: 1 + bob, glyph: BANG, color: 'fx', alpha: 1 }
}
