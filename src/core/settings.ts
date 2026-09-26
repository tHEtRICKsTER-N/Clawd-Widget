import { COSMETICS, type CosmeticId } from '../engine/cosmetics'
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
  /** while idle, Clawd's eyes follow the pointer (desktop: anywhere on screen) */
  eyesFollow: boolean
  /** Clawd dangles while the widget is dragged and lands with a thud */
  dragReact: boolean
  /** clicking Clawd itself pokes it (squish, heart, combo) instead of playing */
  pokes: boolean
  /** now and then Clawd stretches, yawns, scratches or wanders; left alone for a while, it dozes off */
  idleAntics: boolean
  /** while idle, play a random animation every ~this many seconds (0: off, 1: non-stop) */
  autoPlay: number
  /** each auto-play glides into a random theme (shown only: `colors` stays as chosen) */
  shuffleColors: boolean
  /** chiptune sound effects in sync with the grid pulses (off by default) */
  sound: boolean
  /** sound volume, 0–1 */
  volume: number
  /** CRT scanlines and a soft vignette over the button */
  crt: boolean
  /** what Clawd wears (unlocked by achievements) */
  cosmetic: CosmeticId | 'none'
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
  /** 'games': palettes from consoles, fantasy consoles and editor themes */
  group?: 'games'
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
  // palettes people know (console palettes, fantasy consoles and editor themes), from their published colours
  {
    id: 'dmg',
    name: 'Game Boy DMG',
    group: 'games',
    colors: { background: '#306230', glow: '#8bac0f', text: '#9bbc0f', bot: '#0f380f', energy: '#9bbc0f', effectGlow: '#8bac0f', particles: '#9bbc0f' },
  },
  {
    id: 'pico8',
    name: 'PICO-8',
    group: 'games',
    colors: { background: '#1d2b53', glow: '#7e2553', text: '#fff1e8', bot: '#ffa300', energy: '#fff1e8', effectGlow: '#29adff', particles: '#ffec27' },
  },
  {
    id: 'vboy',
    name: 'Virtual Boy',
    group: 'games',
    colors: { background: '#2a0000', glow: '#550000', text: '#ff0000', bot: '#ff0000', energy: '#ff0000', effectGlow: '#aa0000', particles: '#ff0000' },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    group: 'games',
    colors: { background: '#2b1055', glow: '#ff2a6d', text: '#05d9e8', bot: '#ff8a3d', energy: '#b3fbff', effectGlow: '#ff2a6d', particles: '#f9c80e' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    group: 'games',
    colors: { background: '#282a36', glow: '#6272a4', text: '#f8f8f2', bot: '#ffb86c', energy: '#f8f8f2', effectGlow: '#bd93f9', particles: '#ff79c6' },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    group: 'games',
    colors: { background: '#1e1e2e', glow: '#45475a', text: '#cdd6f4', bot: '#fab387', energy: '#f5e0dc', effectGlow: '#cba6f7', particles: '#f9e2af' },
  },
  {
    id: 'tokyonight',
    name: 'Tokyo Night',
    group: 'games',
    colors: { background: '#1a1b26', glow: '#3d59a1', text: '#c0caf5', bot: '#ff9e64', energy: '#c0caf5', effectGlow: '#7aa2f7', particles: '#e0af68' },
  },
  {
    id: 'nord',
    name: 'Nord',
    group: 'games',
    colors: { background: '#2e3440', glow: '#4c566a', text: '#eceff4', bot: '#d08770', energy: '#eceff4', effectGlow: '#88c0d0', particles: '#ebcb8b' },
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
  eyesFollow: true,
  dragReact: true,
  pokes: true,
  idleAntics: true,
  autoPlay: 0,
  shuffleColors: false,
  sound: false,
  volume: 0.5,
  crt: false,
  cosmetic: 'none',
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
    volume: Number.isFinite(Number(s.volume)) ? Math.min(1, Math.max(0, Number(s.volume))) : DEFAULT_SETTINGS.volume,
    hiddenSites: Array.isArray(s.hiddenSites) ? s.hiddenSites.filter((x) => typeof x === 'string') : [],
    cosmetic: COSMETICS.some((c) => c.id === s.cosmetic) ? (s.cosmetic as CosmeticId) : 'none',
    autoPlay: Math.min(86400, Math.max(0, Number(s.autoPlay) || 0)),
    shuffleColors: s.shuffleColors === true,
    colors,
  }
}

/** Auto-play choices: roughly how often (seconds), 1 for back to back */
export const AUTO_PLAY: { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 30, label: 'Every ~30 s' },
  { value: 60, label: 'Every ~1 min' },
  { value: 120, label: 'Every ~2 min' },
  { value: 300, label: 'Every ~5 min' },
  { value: 600, label: 'Every ~10 min' },
  { value: 1800, label: 'Every ~30 min' },
  { value: 1, label: 'Non-stop' },
]

export function fontFamily(s: Settings): string {
  if (s.font === 'custom') return s.customFont ? `'${s.customFont.replace(/'/g, '')}', system-ui, sans-serif` : 'system-ui, sans-serif'
  return (FONTS.find((f) => f.id === s.font) ?? FONTS[0]).family
}

export function fontWeight(s: Settings): number {
  const f = FONTS.find((x) => x.id === s.font) ?? FONTS[0]
  return s.bold ? f.weights.bold : f.weights.regular
}

// ───────────────────────── share codes ─────────────────────────
// A theme as one short string, e.g. "clawd:OiZfWDee__…": the seven colours (3 bytes each, in
// COLOR_KEYS order) and a flags byte (1 = CRT), as base64url. Version it by the prefix.

const CODE_PREFIX = 'clawd:'
export const COLOR_KEYS: (keyof Colors)[] = ['background', 'glow', 'text', 'bot', 'energy', 'effectGlow', 'particles']

export function themeCode(s: Pick<Settings, 'colors' | 'crt'>): string {
  const bytes = new Uint8Array(COLOR_KEYS.length * 3 + 1)
  COLOR_KEYS.forEach((k, i) => bytes.set(hexToRgb(s.colors[k]), i * 3))
  bytes[bytes.length - 1] = s.crt ? 1 : 0
  const b64 = btoa(String.fromCharCode(...bytes))
  return CODE_PREFIX + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The theme in a share code, or null if it isn't one. */
export function parseThemeCode(code: string): { colors: Colors; crt: boolean } | null {
  const c = code.trim()
  if (!c.toLowerCase().startsWith(CODE_PREFIX)) return null
  const body = c.slice(CODE_PREFIX.length)
  if (!/^[A-Za-z0-9_-]{30}$/.test(body)) return null
  let raw: string
  try {
    raw = atob(body.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }
  if (raw.length !== COLOR_KEYS.length * 3 + 1) return null
  const b = (i: number) => raw.charCodeAt(i)
  const flags = b(raw.length - 1)
  if (flags > 1) return null
  const colors = {} as Colors
  COLOR_KEYS.forEach((k, i) => (colors[k] = rgbToHex([b(i * 3), b(i * 3 + 1), b(i * 3 + 2)])))
  return { colors, crt: flags === 1 }
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
