/**
 * The OBS overlay (overlay.html): just the button on a transparent page, set up entirely
 * from the URL so it can be pasted into a Browser Source. This module turns a URL into
 * settings and triggers, and settings back into a URL (for the playground's builder).
 *
 *   theme=clawd:…  share code (colours + CRT), or a preset id (dmg, synthwave, …)
 *   text= font= bold=0|1 size=   crt=1
 *   anim=guitar    what plays (or random)         loop=1  play on and on
 *   play=1|<id>    play when the page loads       every=30  play again every 30 s
 *   state=working  a status (as in Claude Code hooks: working, waiting, done, idle)
 *   sound=1 volume=0–100   wear=crown   idle=0 (no antics)   eyes=0 (no cursor)   pad=8
 *   blink=0   pokes=0 (a click on Clawd plays too)   flash=0 (no tap flash)
 *   autoplay=60|nonstop   while resting, a random animation every ~60 s, or back to back
 *
 * While it's open, changing the hash to #play=<id> or #state=<status> triggers those too.
 * The <clawd-button> element (src/wc) reads the same names from its attributes.
 */

import { ANIMATIONS } from '../engine/animations'
import { COSMETICS } from '../engine/cosmetics'
import type { AnimId } from '../engine/types'
import { STATUSES, type Status } from './renderer'
import { DEFAULT_SETTINGS, FONTS, PRESETS, normalize, parseThemeCode, themeCode, type Settings } from './settings'

export interface Overlay {
  settings: Settings
  /** play this on load */
  play: AnimId | 'random' | null
  /** then again every this many seconds (0: never) */
  every: number
  state: Status | null
  /** margin around the button, px */
  pad: number
}

const isAnim = (v: string | null): v is AnimId => !!v && v in ANIMATIONS
/** "nonstop" (or a bare flag) → 1, a number of seconds → that, "off" / nonsense → 0; absent → the fallback */
function autoPlayOf(v: string | null, fallback: number): number {
  if (v === null) return fallback
  const t = v.trim().toLowerCase()
  if (t === '' || t === 'nonstop' || t === 'non-stop') return 1
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : 0
}
/** absent: the fallback; present with no value (`?loop`, `<clawd-button sound>`): on; 0/false/no/off: off */
const flag = (v: string | null, fallback: boolean) => (v === null ? fallback : !['0', 'false', 'no', 'off'].includes(v.trim().toLowerCase()))

/** Settings from named values (URL parameters, element attributes), on top of `base`. */
export function settingsFrom(get: (name: string) => string | null, base: Settings = DEFAULT_SETTINGS): Settings {
  const themeArg = get('theme') ?? ''
  const preset = PRESETS.find((p) => p.id === themeArg.trim().toLowerCase())
  const theme = preset ? { colors: preset.colors, crt: base.crt } : parseThemeCode(themeArg)
  const anim = get('anim')
  const font = get('font')
  const wear = get('wear')
  const volume = get('volume')
  return normalize({
    ...base,
    ...(theme ?? {}),
    text: get('text') ?? base.text,
    font: FONTS.some((f) => f.id === font) ? font : base.font,
    bold: flag(get('bold'), base.bold),
    size: Number(get('size')) || base.size,
    animation: anim === 'random' || isAnim(anim) ? anim : base.animation,
    playMode: flag(get('loop'), base.playMode === 'loop') ? 'loop' : 'once',
    sound: flag(get('sound'), base.sound),
    volume: volume !== null && volume.trim() !== '' && Number.isFinite(Number(volume)) ? Number(volume) / 100 : base.volume,
    crt: flag(get('crt'), theme?.crt ?? base.crt),
    cosmetic: COSMETICS.some((c) => c.id === wear) ? wear : base.cosmetic,
    idleAntics: flag(get('idle'), base.idleAntics),
    eyesFollow: flag(get('eyes'), base.eyesFollow),
    idleBlink: flag(get('blink'), base.idleBlink),
    pokes: flag(get('pokes'), base.pokes),
    pressFlash: flag(get('flash'), base.pressFlash),
    autoPlay: autoPlayOf(get('autoplay'), base.autoPlay),
    showToolbar: false,
  })
}

export function parseOverlay(q: URLSearchParams): Overlay {
  const settings = settingsFrom((k) => q.get(k), { ...DEFAULT_SETTINGS, sound: false, cosmetic: 'none' })
  const p = q.get('play')
  const st = q.get('state')
  return {
    settings,
    play: p === null || p === '0' ? null : p === 'random' || isAnim(p) ? p : settings.animation,
    every: Math.max(0, Number(q.get('every')) || 0),
    state: STATUSES.includes(st as Status) ? (st as Status) : null,
    pad: Math.max(0, Number(q.get('pad') ?? 8) || 0),
  }
}

/** The overlay URL for these settings (only what differs from the defaults), plus triggers. */
export function overlayUrl(base: string, s: Settings, t: { play?: boolean; every?: number; loop?: boolean }): string {
  const d = DEFAULT_SETTINGS
  const q = new URLSearchParams()
  const code = themeCode(s)
  if (code !== themeCode(d)) q.set('theme', code)
  if (s.text !== d.text) q.set('text', s.text)
  if (s.font !== d.font) q.set('font', s.font)
  if (s.bold !== d.bold) q.set('bold', s.bold ? '1' : '0')
  if (s.size !== d.size) q.set('size', String(s.size))
  if (s.animation !== d.animation) q.set('anim', s.animation)
  if (t.loop) q.set('loop', '1')
  if (t.play) q.set('play', '1')
  if (t.every) q.set('every', String(t.every))
  if (s.sound) q.set('sound', '1')
  if (s.sound && s.volume !== d.volume) q.set('volume', String(Math.round(s.volume * 100)))
  if (s.cosmetic !== 'none') q.set('wear', s.cosmetic)
  if (s.idleAntics !== d.idleAntics) q.set('idle', s.idleAntics ? '1' : '0')
  if (s.eyesFollow !== d.eyesFollow) q.set('eyes', s.eyesFollow ? '1' : '0')
  if (s.autoPlay > 0) q.set('autoplay', s.autoPlay <= 1 ? 'nonstop' : String(s.autoPlay))
  const qs = q.toString()
  return qs ? `${base}?${qs}` : base
}
