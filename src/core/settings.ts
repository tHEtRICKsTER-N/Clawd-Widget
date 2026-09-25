import type { AnimId } from '../engine/types'

export interface Colors {
  /** button base colour (left side is derived darker) */
  background: string
  /** soft glow behind the sprite */
  glow: string
  text: string
  /** Clawd's body */
  bot: string
  /** bright energy cells */
  energy: string
  /** coloured under-glow of the energy cells */
  effectGlow: string
  /** notes, sparks, hearts, confetti */
  particles: string
}

export type FontId = 'inter' | 'space' | 'mono' | 'silkscreen' | 'press' | 'system' | 'serif' | 'custom'

export interface Settings {
  version: 1
  text: string
  font: FontId
  /** any font installed on the computer, used when font = 'custom' */
  customFont: string
  bold: boolean
  colors: Colors
  animation: AnimId | 'random'
  /** once: click plays one time then rests; loop: keeps playing after a click */
  playMode: 'once' | 'loop'
  /** start the button in the dark "pressed" state flash like the original */
  pressFlash: boolean
  idleBlink: boolean
  /** idle Clawd's eyes follow the pointer (desktop: anywhere on screen) */
  followCursor: boolean
  /** widget width in CSS px (height follows the 676×104 aspect) */
  size: number
  showToolbar: boolean
  /** extension: show on web pages at all */
  enabled: boolean
  /** extension: hostnames where the widget is hidden */
  hiddenSites: string[]
}

export interface ThemePreset {
  id: string
  name: string
  colors: Colors
}

export const PRESETS: ThemePreset[] = [
  {
    id: 'original',
    name: 'Original',
    colors: { background: '#3a265f', glow: '#58379e', text: '#ffffff', bot: '#d8764f', energy: '#efe8ff', effectGlow: '#a076f8', particles: '#f0c35a' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: { background: '#1b2a4e', glow: '#2e56a6', text: '#e8f0ff', bot: '#f08a5d', energy: '#e6f3ff', effectGlow: '#5aa0ff', particles: '#ffd166' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: { background: '#5a2340', glow: '#b8456a', text: '#fff4ec', bot: '#ffb35c', energy: '#fff0e0', effectGlow: '#ff7aa2', particles: '#ffe07a' },
  },
  {
    id: 'matrix',
    name: 'Terminal',
    colors: { background: '#0f2a1c', glow: '#1f6b43', text: '#d9ffe8', bot: '#d8764f', energy: '#c9ffd9', effectGlow: '#35e08a', particles: '#a4ff6b' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: { background: '#0f3346', glow: '#1f7a8c', text: '#eafcff', bot: '#ff9f68', energy: '#e8fffd', effectGlow: '#4fd1c5', particles: '#ffe66d' },
  },
  {
    id: 'candy',
    name: 'Candy',
    colors: { background: '#3d2a6b', glow: '#7b5cd6', text: '#ffffff', bot: '#ff8fb1', energy: '#fff0fb', effectGlow: '#ff9de2', particles: '#8ff0ff' },
  },
  {
    id: 'mono',
    name: 'Mono',
    colors: { background: '#26262b', glow: '#4a4a55', text: '#ffffff', bot: '#e8e8e8', energy: '#ffffff', effectGlow: '#9a9aa8', particles: '#ffffff' },
  },
]

export interface FontOption {
  id: FontId
  label: string
  /** CSS font-family stack */
  family: string
  /** bundled font file key (see fonts.ts), if any */
  bundled?: boolean
  weights: { regular: number; bold: number }
}

export const FONTS: FontOption[] = [
  { id: 'inter', label: 'Inter', family: "'Clawd Inter', Inter, ui-sans-serif, system-ui, sans-serif", bundled: true, weights: { regular: 400, bold: 600 } },
  { id: 'space', label: 'Space Grotesk', family: "'Clawd Space Grotesk', ui-sans-serif, system-ui, sans-serif", bundled: true, weights: { regular: 400, bold: 700 } },
  { id: 'mono', label: 'JetBrains Mono', family: "'Clawd JetBrains Mono', ui-monospace, Consolas, monospace", bundled: true, weights: { regular: 400, bold: 700 } },
  { id: 'silkscreen', label: 'Silkscreen (pixel)', family: "'Clawd Silkscreen', monospace", bundled: true, weights: { regular: 400, bold: 700 } },
  { id: 'press', label: 'Press Start 2P (pixel)', family: "'Clawd Press Start 2P', monospace", bundled: true, weights: { regular: 400, bold: 400 } },
  { id: 'system', label: 'System UI', family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", weights: { regular: 400, bold: 600 } },
  { id: 'serif', label: 'Serif', family: "Georgia, 'Times New Roman', serif", weights: { regular: 400, bold: 700 } },
  { id: 'custom', label: 'Custom (installed font)…', family: '', weights: { regular: 400, bold: 700 } },
]

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  text: 'Ultracode',
  font: 'inter',
  customFont: '',
  bold: true,
  colors: { ...PRESETS[0].colors },
  animation: 'guitar',
  playMode: 'once',
  pressFlash: true,
  idleBlink: true,
  followCursor: true,
  size: 340,
  showToolbar: true,
  enabled: true,
  hiddenSites: [],
}

export const SIZES = [
  { label: 'S', value: 240 },
  { label: 'M', value: 340 },
  { label: 'L', value: 466 },
  { label: 'XL', value: 676 },
]

/** Fill any missing / invalid fields from defaults (settings from older versions or bad storage). */
export function normalize(raw: unknown): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>
  const colors = { ...DEFAULT_SETTINGS.colors }
  for (const k of Object.keys(colors) as (keyof Colors)[]) {
    const v = s.colors?.[k]
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) colors[k] = v
  }
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    version: 1,
    text: typeof s.text === 'string' ? s.text.slice(0, 40) : DEFAULT_SETTINGS.text,
    size: Math.min(900, Math.max(160, Number(s.size) || DEFAULT_SETTINGS.size)),
    hiddenSites: Array.isArray(s.hiddenSites) ? s.hiddenSites.filter((x) => typeof x === 'string') : [],
    colors,
  }
}

export function fontFamily(s: Settings): string {
  if (s.font === 'custom') return s.customFont ? `'${s.customFont.replace(/'/g, '')}', system-ui, sans-serif` : 'system-ui, sans-serif'
  return (FONTS.find((f) => f.id === s.font) ?? FONTS[0]).family
}

export function fontWeight(s: Settings): number {
  const f = FONTS.find((x) => x.id === s.font) ?? FONTS[0]
  return s.bold ? f.weights.bold : f.weights.regular
}

// ───────────────────────── colour utils ─────────────────────────

export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')

/** Linear mix: 0 → a, 1 → b. */
export function mix(a: string, b: string, k: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k])
}

export const darken = (c: string, k: number) => mix(c, '#000000', k)
export const lighten = (c: string, k: number) => mix(c, '#ffffff', k)
export const rgbCsv = (c: string) => hexToRgb(c).join(',')
export const rgba = (c: string, a: number) => `rgba(${rgbCsv(c)},${a})`
