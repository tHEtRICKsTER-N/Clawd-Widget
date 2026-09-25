/**
 * Front-facing Clawd pose builder. Every non-guitar animation builds its frames
 * from this, so they all share the traced proportions of FRONT_IDLE:
 * 17×12 body, 2×2 eyes, 4-wide stubby arms, four legs, same canonical grid.
 */

import type { SpriteFrame } from './sprites'

export type Eyes = 'open' | 'closed' | 'happy' | 'wide' | 'look' | 'lookL' | 'lookR'
export type Arm = 'side' | 'up' | 'high' | 'down' | 'none'
/** kickL / kickR: dangling, one pair of legs pulled up (alternate them to kick) */
export type Legs = 'stand' | 'crouch' | 'air' | 'kickL' | 'kickR'
/** pupil offset for open eyes, each axis -1 | 0 | 1 (x < 0 = left, y < 0 = up) */
export type Gaze = [number, number]

export interface FrontPose {
  eyes?: Eyes
  /** where open eyes look (cursor tracking) */
  gaze?: Gaze
  left?: Arm
  right?: Arm
  legs?: Legs
  /** body offset in sprite px (dy < 0 = up) */
  dx?: number
  dy?: number
  mouth?: boolean
  /** body squashed down by n px while the feet stay planted (breathing) */
  squash?: number
  /** draw hands on the laptop (default true) */
  hands?: boolean
  /** laptop in front of the body; typing: 0 both hands down, 1 left up, 2 right up */
  laptop?: boolean
  typing?: 0 | 1 | 2
}

/** gaze per 45° sector, clockwise from "right" (screen y points down) */
const GAZES: Gaze[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]

/**
 * Which way to look at something (dx, dy) away from the eyes, in screen axes.
 * Closer than `face` it's right in front of Clawd: look straight ahead.
 */
export function gazeToward(dx: number, dy: number, face: number): Gaze {
  if (Math.hypot(dx, dy) < face) return [0, 0]
  return GAZES[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8]
}

const TOP = -12
const H = 44
const W = 40

const cache = new Map<string, SpriteFrame>()

export function front(p: FrontPose = {}): SpriteFrame {
  const key = JSON.stringify(p)
  const hit = cache.get(key)
  if (hit) return hit

  const { eyes = 'open', left = 'side', right = 'side', legs = 'stand', dx = 0, dy = 0 } = p
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  const put = (x: number, y: number, ch: string) => {
    const r = y - TOP
    if (r >= 0 && r < H && x >= 0 && x < W) g[r][x] = ch
  }
  const rect = (x0: number, y0: number, w: number, h: number, ch: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, ch)
  }

  const X = 4 + dx
  const crouch = legs === 'crouch'
  const sq = p.squash ?? 0
  const b = 9 + dy + (crouch ? 2 : 0) + sq

  // body + legs
  rect(X + 4, b, 17, 12 - sq, 'O')
  const legRows = crouch ? 2 : 4
  ;[4, 8, 15, 19].forEach((lx, i) => {
    const up = (legs === 'kickL' && i % 2 === 0) || (legs === 'kickR' && i % 2 === 1)
    rect(X + lx, b + 12 - sq, 2, up ? legRows - 1 : legRows, 'O')
  })

  // arms
  const arm = (side: 'l' | 'r', a: Arm) => {
    const x = side === 'l' ? X : X + 21
    if (a === 'side') rect(x, b + 4, 4, 4, 'O')
    else if (a === 'up') rect(x, b + 1, 4, 4, 'O')
    else if (a === 'high') {
      rect(side === 'l' ? x + 1 : x, b - 3, 3, 4, 'O')
      put(side === 'l' ? x + 3 : x, b + 1, 'O')
    } else if (a === 'down') rect(x + (side === 'l' ? 1 : 0), b + 7, 3, 4, 'O')
  }
  arm('l', left)
  arm('r', right)

  // eyes
  const [gx, gy] = p.gaze ?? [0, 0]
  const eye = (ex: number) => {
    switch (eyes) {
      case 'open':
        rect(ex + gx, b + 2 + gy, 2, 2, 'E')
        break
      case 'wide':
        rect(ex, b + 2, 2, 2, 'E')
        put(ex, b + 2, 'W')
        break
      case 'look':
        rect(ex, b + 3, 2, 2, 'E')
        break
      case 'lookL':
        rect(ex - 1, b + 2, 2, 2, 'E')
        break
      case 'lookR':
        rect(ex + 1, b + 2, 2, 2, 'E')
        break
      case 'closed':
        rect(ex - 1, b + 3, 3, 1, 'E')
        break
      case 'happy':
        put(ex - 1, b + 3, 'E')
        put(ex, b + 2, 'E')
        put(ex + 1, b + 3, 'E')
        break
    }
  }
  eye(X + 6)
  eye(X + 17)
  if (p.mouth) rect(X + 11, b + 6, 3, 1, 'E')

  // laptop: back of the lid faces us, logo pixel in the middle
  if (p.laptop) {
    rect(X + 7, b + 6, 11, 5, 'k')
    rect(X + 7, b + 6, 11, 1, 'K')
    rect(X + 7, b + 6, 1, 5, 'K')
    rect(X + 17, b + 6, 1, 5, 'K')
    put(X + 12, b + 8, 'L')
    rect(X + 6, b + 11, 13, 1, 'K')
    if (p.hands !== false) {
      const hand = (hx: number, up: boolean) => rect(hx, b + (up ? 4 : 5), 2, 2, 'O')
      hand(X + 8, p.typing === 1)
      hand(X + 15, p.typing === 2)
    }
  }

  // trim empty rows so drawing is cheap
  let first = g.findIndex((r) => r.some((c) => c !== '.'))
  if (first < 0) first = 0
  let last = H - 1
  while (last > first && g[last].every((c) => c === '.')) last--
  const frame: SpriteFrame = { dx: 0, dy: TOP + first, rows: g.slice(first, last + 1).map((r) => r.join('')) }
  cache.set(key, frame)
  return frame
}
