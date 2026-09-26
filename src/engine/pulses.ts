/**
 * Energy pulses: data describing one expanding wave on the cell grid.
 * Any animation can emit pulses; grid.ts turns them into per-cell light.
 */

import { jitter } from './rand'

export type PulseKind = 'first' | 'strum' | 'power' | 'sway' | 'soft' | 'scan' | 'twinkle' | 'land' | 'trail'

export interface Pulse {
  t0: number
  kind: PulseKind
  /** filled disc that dims as a whole, or a ring with a bright leading band */
  shape: 'disc' | 'ring'
  /** radial = circle around the centre; horizontal = vertical band sweeping sideways */
  metric: 'radial' | 'horizontal'
  /** peak overlay alpha (~1 = near-white) */
  strength: number
  /** radius (cells) = r0 + v·a + q·a² + w·a⁴, a = age in s */
  r0: number
  v: number
  q: number
  w: number
  /** seconds until fully faded */
  life: number
  /** ring interior level relative to the leading band */
  floor: number
  /** e-folding width of the leading band, cells */
  band: number
  /** how much a disc's middle hollows out once grown (0–1) */
  hollow: number
  /** strength of the coloured under-glow relative to `strength` */
  glow: number
  /** centre in grid cells */
  cx: number
  cy: number
  seed: number
}

/** Grid-cell centre of the sprite in the reference layout. */
export const SPRITE_CENTER = { cx: 53.8, cy: 4.6 }

type Base = Omit<Pulse, 't0' | 'kind' | 'cx' | 'cy' | 'seed'>
const D: Base = {
  shape: 'ring',
  metric: 'radial',
  strength: 0.7,
  r0: 1.6,
  v: 58,
  q: 5,
  w: 0,
  life: 0.9,
  floor: 0.22,
  band: 4.2,
  hollow: 0,
  glow: 1,
}

// guitar kinds were fitted against per-cell brightness measured from the reference frames
const KINDS: Record<PulseKind, Partial<Base>> = {
  first: { shape: 'disc', strength: 1.02, v: 32, q: 0, w: 18, life: 1.2, floor: 1, band: 1, hollow: 0.45 },
  power: { strength: 0.84, v: 56, q: 8, life: 0.85, floor: 0.5, band: 6 },
  strum: { strength: 0.68 },
  sway: { strength: 0.74, life: 0.92, floor: 0.32, band: 5 },
  land: { shape: 'disc', strength: 0.92, v: 48, q: 10, life: 1.0, floor: 1, band: 1, hollow: 0.4 },
  soft: { shape: 'disc', strength: 0.34, v: 16, q: 0, life: 1.7, floor: 1, band: 1, hollow: 0.2, glow: 1.6 },
  scan: { metric: 'horizontal', strength: 0.5, v: 62, q: 0, life: 0.95, floor: 0, band: 1.4, glow: 0.6 },
  twinkle: { shape: 'disc', strength: 0.62, r0: 0.55, v: 0, q: 0, life: 0.7, floor: 1, band: 1, glow: 0.4 },
  // a faint single cell (Bug Jump: the glowing track a bug leaves behind)
  trail: { shape: 'disc', strength: 0.3, r0: 0.55, v: 0, q: 0, life: 0.6, floor: 1, band: 1, glow: 0.3 },
}

/** Build a pulse with small seeded variation so repeats never look identical. */
export function makePulse(
  t0: number,
  kind: PulseKind,
  seed: number,
  over: Partial<Pulse> = {},
  center = SPRITE_CENTER,
): Pulse {
  const j = (k: number) => jitter(seed, k)
  const base = { ...D, ...KINDS[kind] }
  const sp = 1 + j(3) * 0.06
  const still = base.v === 0
  return {
    ...base,
    t0: t0 + j(1) * 0.012,
    kind,
    strength: base.strength * (1 + j(2) * 0.06),
    v: base.v * sp,
    q: base.q * sp,
    life: base.life * (1 + j(4) * 0.06),
    cx: center.cx + (still ? 0 : j(5) * 0.45),
    cy: center.cy + (still ? 0 : j(6) * 0.35),
    seed,
    ...over,
  }
}

export type PulseEvent = [t0: number, kind: PulseKind, over?: Partial<Pulse>]

/** Turn a static schedule into the pulses visible at time t. */
export function scheduled(t: number, events: PulseEvent[], seedBase = 0, lookback = 2.2): Pulse[] {
  const out: Pulse[] = []
  events.forEach(([t0, kind, over], i) => {
    if (t0 <= t && t - t0 < lookback) out.push(makePulse(t0, kind, seedBase + i, over))
  })
  return out
}

/** strongest pulse under reduced motion */
export const CALM_CAP = 0.4
/** under reduced motion a pulse needs this much quiet before it (> 1/3 s: at most 3 flashes a second, WCAG 2.3.1) */
export const CALM_GAP = 0.34

/**
 * Reduced motion: drop every pulse that starts less than CALM_GAP after another one, so a
 * burst of rapid strums becomes its first strum and no more than 3 pulses start in any
 * second, and cap how bright any pulse gets. The rule only looks CALM_GAP back, so it
 * never changes its mind as old pulses expire. Twinkles light single cells, too small to
 * count as flashes (and neither do trails), so they are neither dropped nor counted.
 */
export function calmPulses(list: Pulse[]): Pulse[] {
  const small = (p: Pulse) => p.kind === 'twinkle' || p.kind === 'trail'
  const starts = list.filter((p) => !small(p)).map((p) => p.t0)
  return list
    .filter((p) => small(p) || !starts.some((t0) => t0 < p.t0 && p.t0 - t0 < CALM_GAP))
    .map((p) => (p.strength > CALM_CAP ? { ...p, strength: CALM_CAP } : p))
}
