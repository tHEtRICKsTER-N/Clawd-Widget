/**
 * Seasonal (October): lightning, and a jack-o'-lantern appears beside Clawd. Bats flit past,
 * a ghost drifts in from the left and BOO! Clawd jumps out of its skin, shivers, then laughs
 * it off as the ghost floats away.
 */

import { front } from '../clawd'
import { cellAt } from '../grid'
import { tinyText, type Particle } from '../particle'
import { scheduled, type PulseEvent } from '../pulses'
import { pose, type AnimationDef } from '../types'

const FLASH = 0.15
const BOO = 1.9
const LAUGH = 2.9
const END = 4.0

const PUMPKIN = ['...#...', '.#####.', '##.#.##', '#######', '#.#.#.#', '.#####.']
const PUMPKIN_AT = { x: 31, y: 19 }
const GHOST = ['..###..', '.#####.', '##.#.##', '#######', '#######', '#######']
const HEM = [
  ['#.##.##', '#..#..#'],
  ['##.##.#', '#..#..#'],
]
const BAT = [
  ['#...#', '##.##', '.###.'],
  ['.###.', '##.##', '#...#'],
]
const ORANGE = '#ff8a1f'
const STEM = '#4caf50'
const CANDLE = '#ffd84a'
const SHEET = '#f2f4ff'
const WING = '#8c6bc4'

/** the ghost drifts in with a bob, jumps at BOO, floats off after LAUGH */
function ghostAt(t: number): { x: number; y: number; alpha: number } | null {
  if (t < 0.4 || t > LAUGH + 0.7) return null
  const bob = Math.round(Math.sin(t * 6) * 1.5)
  if (t < BOO) return { x: -70 + Math.round(42 * (t - 0.4)), y: 9 + bob, alpha: 0.85 }
  if (t < LAUGH) return { x: -7, y: (t < BOO + 0.25 ? 6 : 9) + bob, alpha: 0.85 }
  const a = t - LAUGH
  return { x: -7 - Math.round(a * 12), y: 9 - Math.round(a * 20) + bob, alpha: a > 0.4 ? 0.4 : 0.7 }
}

export const spooky: AnimationDef = {
  id: 'spooky',
  name: 'Spooky',
  icon: '🎃',
  description: 'Halloween: lightning, a jack-o’-lantern, bats and a ghost that says BOO (October)',
  duration: END,
  loopFrom: 0,
  season: [10, 1, 11, 1],
  pose(t) {
    if (t < FLASH) return pose(front(), { name: 'stand' })
    if (t < FLASH + 0.3) return pose(front({ eyes: 'wide' }), { name: 'lightning' })
    if (t < BOO) return pose(front({ eyes: 'lookR', mouth: t > 1.2 }), { name: t > 1.2 ? 'whistle' : 'admire' })
    if (t < BOO + 0.35) return pose(front({ legs: 'air', dy: -3, eyes: 'wide', left: 'high', right: 'high' }), { name: 'boo!' })
    if (t < LAUGH) {
      const k = Math.floor((t - BOO) / 0.08) % 2
      return pose(front({ eyes: 'wide', left: 'up', right: 'up', squash: k }), { name: k ? 'shiver-b' : 'shiver-a' })
    }
    if (t < LAUGH + 0.7) return pose(front({ eyes: 'happy', mouth: true, left: 'up', right: 'up' }), { name: 'laugh' })
    return pose(front({ eyes: t > END - 0.15 && t < END - 0.05 ? 'closed' : 'lookR' }), { name: 'stand' })
  },
  pulses(t) {
    const ev: PulseEvent[] = [
      // lightning: the whole grid at once, briefly
      [FLASH, 'first', { strength: 0.6, cx: 31, cy: 5, r0: 40, v: 0, q: 0, w: 0, hollow: 0, life: 0.45 }],
      [BOO, 'power', { strength: 0.9, ...cellAt(-4, 12) }],
      [LAUGH, 'soft', { strength: 0.3 }],
    ]
    // the candle flickers in the grid behind the pumpkin
    for (let i = 0; i < 5; i++) ev.push([0.5 + i * 0.6, 'twinkle', { strength: 0.5, ...cellAt(PUMPKIN_AT.x + 3, PUMPKIN_AT.y + 3, true) }])
    return scheduled(t, ev, 3300)
  },
  particles(t) {
    const out: Particle[] = []
    if (t >= FLASH) {
      const { x, y } = PUMPKIN_AT
      const fade = t > END - 0.25 ? 0.5 : 1
      // the candle behind shows through the carved face
      out.push({ x: x + 1, y: y + 2, glyph: ['#####', '#####', '#####'], color: CANDLE, alpha: fade * (Math.floor(t / 0.12) % 3 ? 1 : 0.7) })
      out.push({ x, y, glyph: PUMPKIN, color: ORANGE, top: STEM, alpha: fade })
    }
    // bats flit across the top, right to left
    for (let k = 0; k < 3; k++) {
      const a = t - (0.3 + k * 0.25)
      if (a < 0 || a > 1.7) continue
      const x = 44 - Math.round(a * 80)
      const y = [1, 4, 2][k] + Math.round(Math.sin(a * 9 + k) * 1.2)
      out.push({ x, y, glyph: BAT[Math.floor(a / 0.08) % 2], color: WING, alpha: 1 })
    }
    const g = ghostAt(t)
    if (g) {
      out.push({ x: g.x, y: g.y, glyph: GHOST, color: SHEET, alpha: g.alpha })
      out.push({ x: g.x, y: g.y + GHOST.length, glyph: HEM[Math.floor(t / 0.15) % 2], color: SHEET, alpha: g.alpha })
    }
    if (t >= BOO && t < BOO + 0.7) out.push(...tinyText('BOO!', -24, 3, SHEET))
    return out
  },
}
