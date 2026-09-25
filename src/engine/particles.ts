/**
 * Pixel particles: yellow musical notes, strum sparks, power-chord streaks and the
 * dim grey ♪/♫. All positions are in sprite pixels (same grid as the character)
 * and snapped to whole pixels. Everything is a pure function of time.
 */

import { GREY_NOTE_GLYPHS, NOTE_GLYPHS, SPARK_GLYPHS } from './sprites'
import { greyNoteAt, headNoteEmitsAt, jitter, noteBurstsAt, powerBurstAt, sparkEmitsAt } from './timeline'

export type { Particle }

import { DOT, DOT2, hline, vline, type Particle } from './particle'

// theme colour keys (resolved by the renderer): fx = notes, fxLight = note highlight,
// fxAlt = amber streaks, dim = the grey ♪/♫
const YELLOW = 'fx'
const YELLOW_LIGHT = 'fxLight'
const AMBER = 'fxAlt'
const GREY_NOTE = 'dim'

function notesAbove(t: number, out: Particle[]) {
  for (const e of noteBurstsAt(t)) {
    const baseCols = [15, 21, 27]
    baseCols.forEach((bc, i) => {
      const a = t - e.t0 - i * 0.035
      if (a < 0) return
      const x = bc + Math.round(jitter(e.seed, i, 1) * 1.2)
      const bob = Math.floor((a + i * 0.15) / 0.16) % 2
      if (a < 0.07) {
        out.push({ x: x + 1, y: 7, glyph: DOT2, color: YELLOW, alpha: 0.9 })
      } else if (a < 0.5) {
        const g = NOTE_GLYPHS[(i + Math.floor(e.seed)) % NOTE_GLYPHS.length]
        const rise = Math.min(2, Math.floor((a - 0.07) / 0.15))
        out.push({ x, y: 5 - rise + bob, glyph: g, color: YELLOW, top: YELLOW_LIGHT, alpha: 1 })
      } else if (a < 0.8) {
        const k = (a - 0.5) / 0.3
        const y = 1 - Math.floor(k * 3) + bob
        out.push({ x: x + (i === 2 ? 1 : 0), y, glyph: k < 0.5 ? DOT2 : DOT, color: YELLOW, alpha: k < 0.66 ? 1 : 0.7 })
      }
    })
  }
}

function sparks(t: number, out: Particle[]) {
  for (const e of sparkEmitsAt(t)) {
    const a = t - e.t0
    const n = 2 + (jitter(e.seed, 9) > 0.2 ? 1 : 0)
    for (let k = 0; k < n; k++) {
      const d = k * 0.03
      const aa = a - d
      if (aa < 0) continue
      const x0 = 25 + Math.round(jitter(e.seed, k, 1) * 1.5)
      const y0 = 16 + k * 3 + Math.round(jitter(e.seed, k, 2))
      const x = x0 + Math.floor(aa * 20)
      const y = y0 + Math.floor(aa * 7)
      const g = SPARK_GLYPHS[(k + e.seed) % SPARK_GLYPHS.length]
      out.push({ x, y, glyph: aa > 0.22 ? DOT2 : g, color: YELLOW, alpha: 1 })
    }
  }
}

function headstockNotes(t: number, out: Particle[]) {
  for (const e of headNoteEmitsAt(t)) {
    const a = t - e.t0
    const n = jitter(e.seed, 5) > -0.3 ? 2 : 1
    for (let k = 0; k < n; k++) {
      const aa = a - k * 0.06
      if (aa < 0) continue
      const x = 29 + k * 2 + Math.floor(aa * 11) + Math.round(jitter(e.seed, k) * 1)
      const y = 5 - k * 2 - Math.floor(aa * 12)
      const g = aa < 0.06 ? DOT2 : NOTE_GLYPHS[(k + e.seed) % NOTE_GLYPHS.length]
      out.push({ x, y, glyph: g, color: YELLOW, top: YELLOW_LIGHT, alpha: aa > 0.4 ? 0.7 : 1 })
    }
  }
}

function powerBurst(t: number, out: Particle[]) {
  for (const e of powerBurstAt(t)) {
    const a = t - e.t0
    if (a < 0.09) {
      // sparks crackling off the guitar body during the jump
      for (let k = 0; k < 4; k++) {
        const x = 16 + ((k * 5 + Math.floor(a * 60)) % 8)
        const y = 13 + ((k * 3 + Math.floor(a * 40)) % 9)
        out.push({ x, y, glyph: SPARK_GLYPHS[k % SPARK_GLYPHS.length], color: k % 2 ? AMBER : YELLOW, alpha: 1 })
      }
      continue
    }
    const b = a - 0.09
    const grow = Math.min(1, b / 0.08)
    const fade = b > 0.17 ? 0.6 : 1
    // long streaks shooting right from the guitar
    out.push({ x: 21, y: 17, glyph: hline(Math.round(3 + grow * 8)), color: YELLOW, alpha: fade })
    out.push({ x: 23, y: 19, glyph: hline(Math.round(2 + grow * 7)), color: AMBER, alpha: fade })
    out.push({ x: 20, y: 22, glyph: hline(Math.round(2 + grow * 4)), color: YELLOW, alpha: fade })
    // lower-left streak
    out.push({ x: 12 - Math.round(grow * 6), y: 22, glyph: hline(Math.round(2 + grow * 5)), color: YELLOW, alpha: fade })
    out.push({ x: 9 - Math.round(grow * 3), y: 24, glyph: hline(Math.round(1 + grow * 3)), color: AMBER, alpha: fade })
    // flame licking up from the head
    const fl = Math.round(2 + grow * 6)
    out.push({ x: 18, y: 9 - fl, glyph: vline(fl), color: YELLOW, alpha: fade })
    out.push({ x: 17, y: 9 - Math.round(fl * 0.6), glyph: vline(Math.round(fl * 0.6)), color: AMBER, alpha: fade })
    if (b > 0.04) out.push({ x: 19, y: 5, glyph: DOT, color: YELLOW_LIGHT, alpha: fade })
  }
}

function greyNote(t: number, out: Particle[]) {
  const g = greyNoteAt(t)
  if (!g.visible) return
  const glyph = GREY_NOTE_GLYPHS[g.glyph]
  out.push({ x: g.glyph ? 30 : 31, y: 16 + g.bob, glyph, color: GREY_NOTE, alpha: 0.85 })
}

export function particlesAt(t: number): Particle[] {
  const out: Particle[] = []
  greyNote(t, out)
  notesAbove(t, out)
  sparks(t, out)
  headstockNotes(t, out)
  powerBurst(t, out)
  return out
}
