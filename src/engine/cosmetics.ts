/**
 * Things Clawd can wear (unlocked by achievements): hats that sit on its head, shades
 * over its eyes, headphones. They're placed on any frame, traced or built with front(),
 * by finding the head and the eyes in the frame itself, so they follow every pose.
 */

import type { SpriteFrame } from './sprites'

export type CosmeticId = 'partyhat' | 'propeller' | 'crown' | 'shades' | 'nightcap' | 'headphones'

export const COSMETICS: { id: CosmeticId; name: string; icon: string }[] = [
  { id: 'partyhat', name: 'Party hat', icon: '🥳' },
  { id: 'propeller', name: 'Propeller cap', icon: '🧢' },
  { id: 'crown', name: 'Crown', icon: '👑' },
  { id: 'shades', name: 'Deal-with-it shades', icon: '😎' },
  { id: 'nightcap', name: 'Nightcap', icon: '🌙' },
  { id: 'headphones', name: 'Headphones', icon: '🎧' },
]

/** Colours of the wearables (sprite palette keys, see PALETTE). */
export const COSMETIC_PALETTE: Record<string, string> = {
  P: '#ff6fae',
  Y: '#ffd23f',
  G: '#f5b82e',
  g: '#b8791c',
  R: '#e23d4b',
  B: '#3d7bff',
  N: '#2b3a8f',
  S: '#141018',
  H: '#ffffff',
}

/** Head: top row of the body, its centre and width, in sprite px (frame coordinates). */
export interface Head {
  x: number
  y: number
  w: number
}

const heads = new WeakMap<SpriteFrame, Head | null>()

/** The head is the first row with a run of at least 8 body pixels (raised arms are only 3 wide). */
export function headOf(f: SpriteFrame): Head | null {
  if (f.head) return f.head
  if (heads.has(f)) return heads.get(f)!
  let head: Head | null = null
  for (let r = 0; r < f.rows.length && !head; r++) {
    const m = /[Oo]{8,}/.exec(f.rows[r])
    if (m) head = { x: f.dx + m.index + m[0].length / 2, y: f.dy + r, w: m[0].length }
  }
  heads.set(f, head)
  return head
}

/** Each eye's box [x0, x1] × [y0, y1] (sprite px): 'E' pixels in the head's top 5 rows, left to right. */
export function eyesOf(f: SpriteFrame): [number, number, number, number][] {
  const head = headOf(f)
  if (!head) return []
  const px: [number, number][] = []
  for (let y = head.y; y < head.y + 5; y++) {
    const row = f.rows[y - f.dy] ?? ''
    for (let c = 0; c < row.length; c++) if (row[c] === 'E') px.push([f.dx + c, y])
  }
  px.sort((a, b) => a[0] - b[0])
  // split where there's a gap of more than 2 px between columns
  const eyes: [number, number, number, number][] = []
  for (const [x, y] of px) {
    const e = eyes[eyes.length - 1]
    if (e && x - e[1] <= 2) {
      e[1] = Math.max(e[1], x)
      e[2] = Math.min(e[2], y)
      e[3] = Math.max(e[3], y)
    } else eyes.push([x, x, y, y])
  }
  return eyes
}

/** Pixel art: rows of palette keys ('.' = clear), placed with its bottom row right above the head. */
const HATS: Partial<Record<CosmeticId, string[]>> = {
  partyhat: ['...H...', '...P...', '..PYP..', '..YPY..', '.PYPYP.', '.YPYPY.'],
  propeller: ['.RRR.BBB.', '....S....', '...RRR...', '..BBYBB..', '.BBBYBBB.', 'BBBBYBBBB'],
  crown: ['G...G...G', 'GG.GGG.GG', 'GGGGGGGGG', 'GRGGBGGRG', 'ggggggggg'],
  nightcap: ['.........H', '........HH', '......NN..', '....NNNN..', '..NNNNNN..', '.NNNNNNNN.', 'HHHHHHHHHH'],
}

/** Pixels of a cosmetic worn on this frame: [x, y, palette key], in sprite px. */
export function wear(id: CosmeticId, f: SpriteFrame): [number, number, string][] {
  const head = headOf(f)
  if (!head) return []
  const out: [number, number, string][] = []
  const hat = HATS[id]
  if (hat) {
    const x0 = Math.round(head.x - hat[0].length / 2)
    hat.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] !== '.') out.push([x0 + c, head.y - hat.length + r, row[c]])
    })
    return out
  }
  const left = Math.round(head.x - head.w / 2)
  const right = left + head.w - 1
  if (id === 'shades') {
    const eyes = eyesOf(f)
    if (!eyes.length) return out
    // a bar across the top, a lens over each eye (a pixel of margin) and a glint on each
    const px = new Map<string, [number, number, string]>()
    const put = (x: number, y: number, ch: string) => px.set(`${x},${y}`, [x, y, ch])
    const top = Math.min(...eyes.map((e) => e[2]))
    for (let x = eyes[0][0] - 1; x <= eyes[eyes.length - 1][1] + 1; x++) put(x, top, 'S')
    for (const [x0, x1] of eyes) {
      for (let x = x0 - 1; x <= x1 + 1; x++) put(x, top + 1, 'S')
      put(x0, top, 'H')
    }
    return [...px.values()]
  }
  if (id === 'headphones') {
    // a band over the head and a cup at each side
    for (let x = left; x <= right; x++) out.push([x, head.y - 2, 'S'])
    out.push([left - 1, head.y - 1, 'S'], [right + 1, head.y - 1, 'S'])
    for (const x of [left - 2, left - 1, right + 1, right + 2]) for (let y = head.y; y < head.y + 4; y++) out.push([x, y, 'R'])
    return out
  }
  return out
}
