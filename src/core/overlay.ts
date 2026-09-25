/**
 * The OBS overlay (overlay.html): just the button on a transparent page, set up entirely
 * from the URL so it can be pasted into a Browser Source. This module turns a URL into
 * settings and triggers, and settings back into a URL (for the playground's builder).
 *
 *   theme=clawd:…  share code (colours + CRT)     text= font= bold=0|1 size=
 *   anim=guitar    what plays (or random)         loop=1  play on and on
 *   play=1|<id>    play when the page loads       every=30  play again every 30 s
 *   state=working  a status (as in Claude Code hooks: working, waiting, done, idle)
 *   sound=1 volume=0–100   wear=crown   idle=0 (no antics)   eyes=0 (no cursor)   pad=8
 *
 * While it's open, changing the hash to #play=<id> or #state=<status> triggers those too.
 */

import { ANIMATIONS } from '../engine/animations'
import { COSMETICS } from '../engine/cosmetics'
import type { AnimId } from '../engine/types'
import { STATUSES, type Status } from './renderer'
import { DEFAULT_SETTINGS, FONTS, normalize, parseThemeCode, themeCode, type Settings } from './settings'

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
const flag = (v: string | null, fallback: boolean) => (v === null ? fallback : v === '1' || v === 'true' || v === 'yes')

export function parseOverlay(q: URLSearchParams): Overlay {
  const d = DEFAULT_SETTINGS
  const theme = parseThemeCode(q.get('theme') ?? '')
  const anim = q.get('anim')
  const font = q.get('font')
  const wear = q.get('wear')
  const settings = normalize({
    ...d,
    ...(theme ?? {}),
    text: q.get('text') ?? d.text,
    font: FONTS.some((f) => f.id === font) ? font : d.font,
    bold: flag(q.get('bold'), d.bold),
    size: Number(q.get('size')) || d.size,
    animation: anim === 'random' || isAnim(anim) ? anim : d.animation,
    playMode: flag(q.get('loop'), false) ? 'loop' : 'once',
    sound: flag(q.get('sound'), false),
    volume: q.get('volume') !== null ? Number(q.get('volume')) / 100 : d.volume,
    cosmetic: COSMETICS.some((c) => c.id === wear) ? wear : 'none',
    idleAntics: flag(q.get('idle'), d.idleAntics),
    eyesFollow: flag(q.get('eyes'), d.eyesFollow),
    idleBlink: flag(q.get('blink'), d.idleBlink),
    showToolbar: false,
  })
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
  const qs = q.toString()
  return qs ? `${base}?${qs}` : base
}
