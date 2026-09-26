/**
 * Shared particle type + tiny glyph library. Positions are in sprite pixels and
 * always whole numbers, so particles stay on the same pixel grid as Clawd.
 */

/** Theme colour keys resolved by the renderer (or a literal CSS colour). */
export type ColorKey = 'fx' | 'fxLight' | 'fxAlt' | 'dim' | 'energy' | 'bot' | 'glow' | 'text' | 'c0' | 'c1' | 'c2' | 'c3'

export interface Particle {
  x: number
  y: number
  glyph: string[]
  color: ColorKey | string
  /** optional colour for the top row of the glyph */
  top?: ColorKey | string
  alpha: number
}

export const DOT = ['#']
export const DOT2 = ['##']
export const hline = (n: number) => ['#'.repeat(Math.max(1, n))]
export const vline = (n: number) => Array.from({ length: Math.max(1, n) }, () => '#')

export const HEART = ['##.##', '#####', '.###.', '..#..']
export const HEART_S = ['#.#', '###', '.#.']
export const STAR = ['.#.', '###', '.#.']
export const STAR_L = ['..#..', '..#..', '##.##', '..#..', '..#..']
export const CHECK = ['....#', '...#.', '#.#..', '.#...']
export const BANG = ['#', '#', '#', '.', '#']
export const Z_M = ['####', '..#.', '.#..', '####']
export const Z_L = ['#####', '...#.', '..#..', '.#...', '#####']
/** a bug (Bug Jump, Bug Squash); flip the rows for the other step */
export const BUG = ['.#.#.', '#####', '.#.#.']
export const BUG_COLOR = '#ff4d5e'
export const ARROW_UP = ['..#..', '.###.', '#####', '.###.', '.###.']

export const CODE_GLYPHS: string[][] = [
  ['..#', '.#.', '#..', '.#.', '..#'], // <
  ['#..', '.#.', '..#', '.#.', '#..'], // >
  ['..#', '..#', '.#.', '#..', '#..'], // /
  ['.##', '.#.', '#..', '.#.', '.##'], // {
  ['##.', '.#.', '..#', '.#.', '##.'], // }
  ['.#', '##', '.#', '.#', '.#'], // 1
  ['###', '#.#', '#.#', '#.#', '###'], // 0
  ['#.#', '.#.', '#.#'], // ×
]

/** 3×5 pixel font for short counters like "x10!" (every glyph is 5 rows, bottom-aligned) */
const TINY: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  x: ['...', '...', '#.#', '.#.', '#.#'],
  '!': ['#', '#', '#', '.', '#'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  L: ['#..', '#..', '#..', '#..', '###'],
  V: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  '♥': ['##.##', '#####', '#####', '.###.', '..#..'],
}

/** Width in px of a tiny-font string (1 px between characters). */
export const tinyWidth = (s: string) => [...s].reduce((w, ch) => w + (TINY[ch]?.[0].length ?? 3) + 1, -1)

/** A tiny-font string as particles, top-left at (x, y). */
export function tinyText(s: string, x: number, y: number, color: Particle['color'], alpha = 1): Particle[] {
  const out: Particle[] = []
  for (const ch of s) {
    const glyph = TINY[ch]
    if (glyph) out.push({ x, y, glyph, color, alpha })
    x += (glyph?.[0].length ?? 3) + 1
  }
  return out
}
