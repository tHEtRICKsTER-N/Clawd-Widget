/**
 * Choreography, reverse-engineered from the reference recording (27 fps, 12.37 s).
 *
 * Time `t` is seconds on the same clock as the reference clip, so t=0 is the
 * first frame of the recording (dark button, just tapped). Everything here is a
 * pure function of `t`, which makes scrubbing / frame-stepping exact.
 *
 *   0.00–0.13  dark grey button (pressed)
 *   0.13–0.28  fades to purple (a little over-bright, settles by ~1.7 s)
 *   0.22–0.30  Clawd pops in, front-facing
 *   0.30–0.74  idle + small bounce
 *   0.74–1.30  pulls a guitar up
 *   1.30–1.63  side-on, guitar vertical
 *   1.63–4.52  move A (sway, notes above) — first big pixel pulse at 2.60
 *   4.52+      3.675 s loop:  B shred+sparks → C headstock notes → wind-up →
 *              D power chord → A sway+notes
 */

import type { FrameName } from './sprites'
import { makePulse, type Pulse, type PulseKind } from './pulses'
import { hash, jitter } from './rand'

export const FPS_REF = 27
export const CLIP_DURATION = 12.37
export const LOOP_START = 4.52
export const LOOP_PERIOD = 3.675

/** Loop segments, seconds relative to the start of each cycle. */
export const SEG = {
  B: [0, 0.84],
  C: [0.84, 1.44],
  WINDUP: [1.44, 1.9],
  D: [1.9, 2.13],
  A: [2.13, LOOP_PERIOD],
} as const

/** Strum onsets inside a cycle (each fires an energy pulse). */
const B_STRUMS = [0, 0.18, 0.34, 0.51]
const C_STRUMS = [0.84, 1.0, 1.18, 1.34]
const D_HITS = [2.02, 2.35]
const A_HITS = [2.92]

/** Notes-above bursts (cycle-relative), plus the two in the pre-loop. */
const A_NOTE_BURSTS = [2.13, 2.88]
const PRELOOP_NOTE_BURSTS = [2.02, 3.66]

export interface Emit {
  t0: number
  seed: number
}

export { hash, jitter }

export function cycleOf(t: number): { n: number; u: number } {
  const x = t - LOOP_START
  const n = Math.floor(x / LOOP_PERIOD)
  return { n, u: x - n * LOOP_PERIOD }
}

/** All pulses that can still be visible at time t. */
export function pulsesAt(t: number, lookback = 2.2): Pulse[] {
  const out: Pulse[] = []
  const push = (t0: number, kind: PulseKind, seed: number) => {
    if (t0 <= t && t - t0 < lookback) out.push(makePulse(t0, kind, seed))
  }
  // pre-loop
  push(2.59, 'first', 1)
  push(3.778, 'sway', 2)
  // loop cycles overlapping [t-lookback, t]
  const { n } = cycleOf(t)
  for (let c = Math.max(0, n - 1); c <= n; c++) {
    const base = LOOP_START + c * LOOP_PERIOD
    B_STRUMS.forEach((s, i) => push(base + s, 'strum', 100 + c * 20 + i))
    C_STRUMS.forEach((s, i) => push(base + s, 'strum', 104 + c * 20 + i))
    D_HITS.forEach((s, i) => push(base + s, 'power', 108 + c * 20 + i))
    A_HITS.forEach((s, i) => push(base + s, 'sway', 110 + c * 20 + i))
  }
  return out
}

// ───────────────────────── background state ─────────────────────────

/** 1 = dark grey pre-tap state, 0 = purple. Eases in over 0.15–0.34 s. */
export function darkMix(t: number): number {
  if (t <= 0.15) return 1
  if (t >= 0.34) return 0
  const x = (t - 0.15) / 0.19
  return 1 - x * x
}

/** Extra brightness of the purple right after activation: peaks ~0.34–0.5 s, settles by ~1.9 s. */
export function introGlow(t: number): number {
  if (t < 0.2) return 0
  if (t < 0.34) return (t - 0.2) / 0.14
  if (t < 0.5) return 1
  const x = (t - 0.5) / 1.4
  return x >= 1 ? 0 : (1 - x) * (1 - x)
}

// ───────────────────────── sprite state ─────────────────────────

export interface SpriteState {
  frame: FrameName | null
  /** pixel-snapped pop-in scale (1 = normal) */
  scale: number
  opacity: number
  /** extra offset in sprite px */
  ox: number
  oy: number
}

/** A1/A2 alternate every ~0.26 s, starting with A1 at the top of each A segment. */
function swayFrame(t: number, start: number): FrameName {
  return Math.floor((t - start) / 0.26) % 2 === 0 ? 'PLAY_A1' : 'PLAY_A2'
}

function strumFrame(u: number, strums: number[], down: FrameName, up: FrameName): FrameName {
  let last = -1
  for (const s of strums) if (u >= s) last = s
  return last >= 0 && u - last < 0.09 ? down : up
}

export function spriteAt(t: number): SpriteState {
  const S = (frame: FrameName | null, scale = 1, opacity = 1, ox = 0, oy = 0): SpriteState => ({
    frame,
    scale,
    opacity,
    ox,
    oy,
  })
  if (t < 0.22) return S(null)
  if (t < 0.27) return S('FRONT_IDLE', 0.5, 0.55)
  if (t < 0.32) return S('FRONT_IDLE', 0.75, 0.9)
  if (t < 0.52) return S('FRONT_IDLE')
  if (t < 0.63) return S('FRONT_BOB')
  if (t < 0.74) return S('FRONT_IDLE')
  if (t < 1.0) return S('FRONT_GUITAR_1')
  if (t < 1.3) return S('FRONT_GUITAR_2')
  if (t < 1.63) return S('SIDE_VERTICAL')
  if (t < LOOP_START) return S(swayFrame(t, 1.63))

  const { n, u } = cycleOf(t)
  if (u < SEG.B[1]) return S(strumFrame(u, B_STRUMS, 'PLAY_B1', 'PLAY_B2'))
  if (u < SEG.C[1]) return S(strumFrame(u, C_STRUMS, 'PLAY_C1', 'PLAY_C2'))
  if (u < SEG.WINDUP[1]) return S('WINDUP')
  if (u < SEG.D[1]) return S(u < 2.0 ? 'POWER_1' : 'POWER_2')
  return S(swayFrame(t, LOOP_START + n * LOOP_PERIOD + SEG.A[0]))
}

// ───────────────────────── particle emitters ─────────────────────────

export type Segment = 'intro' | 'A' | 'B' | 'C' | 'WINDUP' | 'D'

export function segmentAt(t: number): { seg: Segment; start: number; end: number } {
  if (t < 1.63) return { seg: 'intro', start: 0, end: 1.63 }
  if (t < LOOP_START) return { seg: 'A', start: 1.63, end: LOOP_START }
  const { n, u } = cycleOf(t)
  const base = LOOP_START + n * LOOP_PERIOD
  for (const k of ['B', 'C', 'WINDUP', 'D', 'A'] as const) {
    const [a, b] = SEG[k]
    if (u >= a && u < b) return { seg: k, start: base + a, end: base + b }
  }
  return { seg: 'A', start: base + SEG.A[0], end: base + SEG.A[1] }
}

/** Collect emitter events of a given list of cycle-relative times, within [t-life, t]. */
function cycleEvents(t: number, rel: number[], life: number, seedBase: number): Emit[] {
  const out: Emit[] = []
  const { n } = cycleOf(t)
  for (let c = Math.max(0, n - 1); c <= n; c++) {
    rel.forEach((r, i) => {
      const t0 = LOOP_START + c * LOOP_PERIOD + r
      if (t0 <= t && t - t0 < life) out.push({ t0, seed: seedBase + c * 50 + i })
    })
  }
  return out
}

export function noteBurstsAt(t: number): Emit[] {
  const life = 0.8
  const out: Emit[] = PRELOOP_NOTE_BURSTS.filter((t0) => t0 <= t && t - t0 < life).map((t0, i) => ({
    t0,
    seed: 900 + i,
  }))
  if (t >= LOOP_START) out.push(...cycleEvents(t, A_NOTE_BURSTS, life, 1000))
  return out
}

export function sparkEmitsAt(t: number): Emit[] {
  return t >= LOOP_START ? cycleEvents(t, B_STRUMS, 0.32, 2000) : []
}

export function headNoteEmitsAt(t: number): Emit[] {
  return t >= LOOP_START ? cycleEvents(t, C_STRUMS, 0.5, 3000) : []
}

export function powerBurstAt(t: number): Emit[] {
  return t >= LOOP_START ? cycleEvents(t, [1.9], 0.34, 4000) : []
}

/** Grey ♪/♫ to the right of the guitar during the A sway. */
export function greyNoteAt(t: number): { visible: boolean; glyph: number; bob: number; seed: number } {
  const { seg, start, end } = segmentAt(t)
  if (seg !== 'A') return { visible: false, glyph: 0, bob: 0, seed: 0 }
  const a = t - start
  const b = end - t
  const visible = a > 0.35 && b > 0.12
  const glyph = Math.floor(a / 0.42) % 3 === 0 ? 0 : 1
  const bob = Math.floor(a / 0.3) % 2
  return { visible, glyph, bob, seed: Math.floor(start * 10) }
}
