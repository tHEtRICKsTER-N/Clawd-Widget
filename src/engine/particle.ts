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
