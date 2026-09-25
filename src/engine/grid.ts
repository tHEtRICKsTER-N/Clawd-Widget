/**
 * Square-cell energy field.
 *
 * Reference grid: 11 px pitch with 1 px dark gutters, lines at x,y ≡ 10 (mod 11),
 * i.e. cell (c,r) covers [11c, 11c+10) × [11r, 11r+10) in the 676×104 button.
 *
 * Every strum fires a pulse centred on the sprite. It pops in as a small
 * near-white disc of cells and its edge then races left (clipped on the right),
 * accelerating as it goes. "Disc" pulses (the big hits) stay filled and dim as
 * a whole. "Ring" pulses (strums) keep a bright leading band over a dim interior,
 * so rapid strums stack into stepped vertical bands. A faint sawtooth in
 * distance-behind-the-front makes the band edges step cell by cell.
 * Pulses combine with screen blending.
 */

import type { Pulse } from './pulses'
import { hash } from './rand'

export const CELL = 11
export const CELL_INNER = 10
export const REF_W = 676
export const REF_H = 104
export const COLS = Math.ceil(REF_W / CELL) // 62
export const ROWS = Math.ceil(REF_H / CELL) // 10
export const LEVELS = 20

export function pulseRadius(p: Pulse, a: number): number {
  const a2 = a * a
  return p.r0 + p.v * a + p.q * a2 + p.w * a2 * a2
}

function pulseAlpha(p: Pulse, a: number, d: number, R: number): number {
  if (d > R) return 0
  const behind = R - d
  const k = 1 - a / p.life
  if (k <= 0) return 0
  const env = Math.pow(k, 1.15)
  let prof: number
  if (p.shape === 'disc') {
    // mostly flat; the middle hollows out a little once the disc has grown
    const hollow = a > 0.12 ? p.hollow * Math.exp(-d / 4.5) * Math.min(1, (a - 0.12) / 0.15) : 0
    prof = 1 - hollow
  } else {
    // bright leading band, dim interior; young rings are still solid discs
    const ring = p.floor + (1 - p.floor) * Math.exp(-behind / p.band)
    const solid = a < 0.05 ? 1 : Math.max(0, 1 - (a - 0.05) / 0.07)
    prof = ring + (1 - ring) * solid
  }
  // sawtooth banding behind the front (period ~6.5 cells, ±6%)
  const saw = ((behind / 6.5) % 1) - 0.5
  return p.strength * env * prof * (1 + saw * 0.12)
}

/** Per-cell static noise so stepped edges are a little irregular (like the reference). */
const NOISE = new Float32Array(COLS * ROWS)
for (let i = 0; i < NOISE.length; i++) NOISE[i] = hash(i * 7 + 3) * 2 - 1

/**
 * Purple under-glow of a pulse: concentrated around the sprite, lingers a little
 * longer than the white energy. Turns aged cells saturated lavender instead of grey.
 */
function pulseGlow(p: Pulse, a: number, d: number, R: number): number {
  if (d > R) return 0
  const k = 1 - a / (p.life * 1.15)
  if (k <= 0) return 0
  return 0.42 * p.glow * p.strength * k * Math.exp(-d / 9)
}

export interface Field {
  /** white energy overlay alpha per cell */
  lit: Float32Array
  /** purple glow overlay alpha per cell */
  glow: Float32Array
}

export const createField = (): Field => ({
  lit: new Float32Array(COLS * ROWS),
  glow: new Float32Array(COLS * ROWS),
})

const quantize = (v: number, i: number) => {
  if (v <= 0.02) return 0
  v = Math.min(1, v * (1 + NOISE[i] * 0.04))
  return Math.round(v * LEVELS) / LEVELS
}

/**
 * Compute quantized per-cell overlay alphas (row-major, COLS*ROWS) at time t.
 * Pulses combine with screen blending: 1 - Π(1 - aᵢ).
 */
export function computeField(t: number, pulses: Pulse[], f: Field): Field {
  const { lit, glow } = f
  lit.fill(1)
  glow.fill(1)
  for (const p of pulses) {
    const a = t - p.t0
    const R = pulseRadius(p, a)
    for (let r = 0; r < ROWS; r++) {
      const dy = r + 0.5 - p.cy
      for (let c = 0; c < COLS; c++) {
        const dx = c + 0.5 - p.cx
        const d = p.metric === 'horizontal' ? Math.abs(dx) : Math.sqrt(dx * dx + dy * dy)
        const i = r * COLS + c
        const v = pulseAlpha(p, a, d, R)
        if (v > 0) lit[i] *= 1 - Math.min(1, v)
        const g = pulseGlow(p, a, d, R)
        if (g > 0) glow[i] *= 1 - Math.min(1, g)
      }
    }
  }
  for (let i = 0; i < lit.length; i++) {
    lit[i] = quantize(1 - lit[i], i)
    glow[i] = quantize(1 - glow[i], i)
  }
  return f
}
