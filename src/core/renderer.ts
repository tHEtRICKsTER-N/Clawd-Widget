/**
 * Framework-free renderer for the pixel button. Used by the React demo, the
 * browser extension (inside a shadow root) and the desktop widget.
 *
 * Layers (bottom → top, all clipped by the rounded button):
 *   background (CSS gradient from theme) → intro glow → pressed-dark flash →
 *   grid canvas → sprite canvas → particle canvas → label
 */

import { ANIMATIONS, idlePose, pickRandom } from '../engine/animations'
import { BODY, type Gaze } from '../engine/clawd'
import { lingerFrame, playFrame } from '../engine/frame'
import { CELL, CELL_INNER, COLS, REF_H, REF_W, ROWS, computeField, createField } from '../engine/grid'
import type { Particle } from '../engine/particle'
import type { Pulse } from '../engine/pulses'
import { PALETTE, SPRITE_ORIGIN, SPRITE_UNIT } from '../engine/sprites'
import { darkMix, introGlow } from '../engine/timeline'
import type { AnimationDef, AnimId, Pose } from '../engine/types'
import { ensureFont } from './fonts'
import { darken, fontFamily, fontWeight, lighten, mix, rgba, rgbCsv, type Settings } from './settings'

export const BUTTON_CSS = `
.cw-btn{position:relative;display:block;overflow:hidden;isolation:isolate;cursor:pointer;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;outline:none;box-sizing:border-box;margin:0;padding:0;border:0;contain:layout paint}
.cw-btn:focus-visible{box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.cw-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block}
.cw-canvas{image-rendering:pixelated;image-rendering:crisp-edges}
.cw-dark{background:#1c1e1b;opacity:0}
.cw-intro{opacity:0}
.cw-label{position:absolute;top:50%;transform:translateY(-52%);white-space:nowrap;pointer-events:none;line-height:1;
  font-style:normal;text-transform:none;text-shadow:none;letter-spacing:-0.01em;margin:0;padding:0}
`

const PRESS_COLOR = '#1c1e1b'
/** leftmost reference-px the label may use before running into the sprite */
const LABEL_LEFT = 22
const LABEL_RIGHT = 540
const LABEL_SIZE = 30.5
/** ms of pointer stillness before Clawd stops watching it and goes back to glancing around */
const WATCH_FOR = 3000

export interface RendererOptions {
  /** called when a single play finishes */
  onEnd?: () => void
  /** called whenever a play starts (with the resolved animation id) */
  onPlay?: (id: AnimId) => void
}

export interface RendererState {
  mode: 'idle' | 'play' | 'controlled'
  anim: AnimId | null
  t: number
  pose: string
}

export class ClawdButton {
  readonly el: HTMLDivElement
  private s: Settings
  private opts: RendererOptions
  private bg: HTMLSpanElement
  private intro: HTMLSpanElement
  private dark: HTMLSpanElement
  private label: HTMLSpanElement
  private cGrid: HTMLCanvasElement
  private cSprite: HTMLCanvasElement
  private cFx: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private sp: CanvasRenderingContext2D
  private fx: CanvasRenderingContext2D
  private field = createField()
  private W = 0
  private H = 0
  private k = 1 // ref px → device px
  private dpr = 1
  private raf = 0
  private last = 0
  private speed = 1

  private mode: 'idle' | 'play' = 'idle'
  private anim: AnimationDef | null = null
  private lastAnimId: AnimId | null = null
  private playT = 0
  private idleT = 0
  private linger: { anim: AnimationDef; end: number; t: number } | null = null
  private controlled: { t: number; anim: AnimId } | null = null
  private drawnKey = ''
  private palette: Record<string, string> = { ...PALETTE }
  private fxColors: Record<string, string> = {}
  private stateCache: RendererState = { mode: 'idle', anim: null, t: 0, pose: '' }
  /** where the pointer was last seen (client px) and when (performance.now() ms) */
  private pointer: { x: number; y: number; at: number } | null = null

  constructor(parent: Element | ShadowRoot, settings: Settings, opts: RendererOptions = {}) {
    this.s = settings
    this.opts = opts
    const el = document.createElement('div')
    el.className = 'cw-btn'
    el.setAttribute('role', 'button')
    el.tabIndex = 0
    const span = (cls: string) => {
      const x = document.createElement('span')
      x.className = cls
      el.appendChild(x)
      return x
    }
    const canvas = () => {
      const c = document.createElement('canvas')
      c.className = 'cw-layer cw-canvas'
      c.setAttribute('aria-hidden', 'true')
      el.appendChild(c)
      return c
    }
    this.bg = span('cw-layer cw-bg')
    this.intro = span('cw-layer cw-intro')
    this.dark = span('cw-layer cw-dark')
    this.cGrid = canvas()
    this.cSprite = canvas()
    this.cFx = canvas()
    this.label = span('cw-label')
    this.g = this.cGrid.getContext('2d')!
    this.sp = this.cSprite.getContext('2d')!
    this.fx = this.cFx.getContext('2d')!
    this.el = el
    parent.appendChild(el)
    this.applySettings()
    window.addEventListener('pointermove', this.onPointerMove, { capture: true, passive: true })
    this.raf = requestAnimationFrame(this.tick)
  }

  // ───────────────────────── public API ─────────────────────────

  setSettings(s: Settings) {
    const prev = this.s
    this.s = s
    this.applySettings(prev)
  }

  get settings() {
    return this.s
  }

  /** Play an animation (default: the one chosen in settings; 'random' picks a different one each time). */
  play(id?: AnimId | 'random') {
    const want = id ?? this.s.animation
    const resolved: AnimId = want === 'random' ? pickRandom(this.lastAnimId) : want
    this.anim = ANIMATIONS[resolved]
    this.lastAnimId = resolved
    this.mode = 'play'
    this.playT = 0
    this.linger = null
    this.opts.onPlay?.(resolved)
  }

  /** Return to the resting state. */
  stop() {
    if (this.mode === 'play' && this.anim) this.linger = { anim: this.anim, end: Math.min(this.playT, this.anim.duration), t: 0 }
    this.mode = 'idle'
  }

  get playing() {
    return this.mode === 'play'
  }

  setSpeed(x: number) {
    this.speed = x
  }

  /** Dev/testing: render a fixed time of one animation (null = back to normal). */
  setControlled(t: number | null, anim: AnimId = 'guitar') {
    this.controlled = t === null ? null : { t, anim }
  }

  get state(): RendererState {
    return this.stateCache
  }

  /**
   * The pointer is at (x, y), in this page's client coordinates. The button already
   * follows pointer moves on its own page; hosts that know more (the desktop app sees
   * the mouse anywhere on screen) call this too.
   */
  lookAt(x: number, y: number) {
    this.pointer = { x, y, at: performance.now() }
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('pointermove', this.onPointerMove, { capture: true })
    this.el.remove()
  }

  private onPointerMove = (e: PointerEvent) => this.lookAt(e.clientX, e.clientY)

  // ───────────────────────── settings → DOM ─────────────────────────

  private applySettings(prev?: Settings) {
    const s = this.s
    const c = s.colors
    const width = s.size
    const height = Math.round((width * REF_H) / REF_W)
    const kk = width / REF_W
    const st = this.el.style
    st.width = `${width}px`
    st.height = `${height}px`
    st.borderRadius = `${32 * kk}px`
    this.el.setAttribute('aria-label', s.text || 'Clawd button')

    const bgc = c.background
    this.bg.style.background = [
      `radial-gradient(12.5% 105% at 88.8% 50%, ${c.glow} 0%, ${rgba(c.glow, 0.62)} 42%, ${rgba(c.glow, 0)} 100%)`,
      `linear-gradient(90deg, ${darken(bgc, 0.36)} 0%, ${darken(bgc, 0.28)} 22%, ${darken(bgc, 0.2)} 44%, ${darken(bgc, 0.08)} 64%, ${bgc} 78%, ${lighten(bgc, 0.03)} 90%, ${darken(bgc, 0.06)} 100%)`,
    ].join(',')
    this.intro.style.background = [
      `radial-gradient(16% 120% at 88.8% 50%, ${rgba(lighten(c.glow, 0.35), 0.3)}, ${rgba(lighten(c.glow, 0.35), 0)} 100%)`,
      rgba(lighten(bgc, 0.35), 0.24),
    ].join(',')
    this.el.style.background = darken(bgc, 0.3)
    this.dark.style.background = PRESS_COLOR

    const L = this.label.style
    L.left = `${LABEL_LEFT * kk}px`
    L.color = c.text
    L.fontFamily = fontFamily(s)
    L.fontWeight = String(fontWeight(s))
    this.label.textContent = s.text

    this.palette = { ...PALETTE, O: c.bot, o: darken(c.bot, 0.2) }
    this.fxColors = {
      fx: c.particles,
      fxLight: mix(c.particles, '#ffffff', 0.45),
      fxAlt: mix(c.particles, c.bot, 0.35),
      dim: mix(c.particles, '#4a4a4a', 0.72),
      energy: c.energy,
      bot: c.bot,
      glow: c.effectGlow,
      text: c.text,
      c0: c.particles,
      c1: c.energy,
      c2: c.bot,
      c3: lighten(c.effectGlow, 0.2),
    }

    this.resize()
    const fontChanged = !prev || prev.font !== s.font || prev.customFont !== s.customFont || prev.bold !== s.bold
    this.fitLabel()
    if (fontChanged) void ensureFont(s.font).then(() => this.fitLabel())
    this.drawnKey = ''
  }

  private fitLabel() {
    const kk = this.s.size / REF_W
    const base = LABEL_SIZE * kk
    this.label.style.fontSize = `${base}px`
    const avail = (LABEL_RIGHT - LABEL_LEFT) * kk
    const w = this.label.scrollWidth
    if (w > avail && w > 0) this.label.style.fontSize = `${Math.max(8, (base * avail) / w)}px`
  }

  private resize() {
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))
    const W = Math.round(this.s.size * dpr)
    const H = Math.round(((this.s.size * REF_H) / REF_W) * dpr)
    if (W === this.W && H === this.H && dpr === this.dpr) return
    this.dpr = dpr
    this.W = W
    this.H = H
    this.k = (this.s.size / REF_W) * dpr
    for (const [c, ctx] of [
      [this.cGrid, this.g],
      [this.cSprite, this.sp],
      [this.cFx, this.fx],
    ] as const) {
      c.width = W
      c.height = H
      ctx.imageSmoothingEnabled = false
    }
    this.drawnKey = ''
  }

  // ───────────────────────── frame loop ─────────────────────────

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick)
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0
    this.last = now
    if (Math.max(1, Math.round(window.devicePixelRatio || 1)) !== this.dpr) this.resize()

    let anim: AnimationDef | null = null
    let t = 0
    let fieldT = 0
    let pulses: Pulse[] = []
    let particles: Particle[] = []
    let pose: Pose

    if (this.controlled) {
      anim = ANIMATIONS[this.controlled.anim]
      t = this.controlled.t
    } else if (this.mode === 'play' && this.anim) {
      this.playT += dt * this.speed
      if (this.s.playMode === 'once' && this.playT >= this.anim.duration) {
        this.linger = { anim: this.anim, end: this.anim.duration, t: 0 }
        this.mode = 'idle'
        this.idleT = 0
        this.opts.onEnd?.()
      } else {
        anim = this.anim
        t = this.playT
      }
    }

    if (anim) {
      const f = playFrame(anim, t)
      pose = f.pose
      pulses = f.pulses
      particles = f.particles
      fieldT = f.fieldT
    } else {
      this.idleT += dt * this.speed
      pose = idlePose(this.idleT, this.s.idleBlink, this.gaze(now))
      if (this.linger) {
        this.linger.t += dt * this.speed
        const f = lingerFrame(this.linger.anim, this.linger.end, this.linger.t)
        if (!f) this.linger = null
        else {
          pulses = f.pulses
          fieldT = f.fieldT
        }
      }
    }

    const press = anim?.pressIntro && this.s.pressFlash ? t : Infinity
    const dm = darkMix(press)
    const ig = introGlow(press)
    this.stateCache = {
      mode: this.controlled ? 'controlled' : this.mode,
      anim: anim?.id ?? null,
      t,
      pose: pose.name ?? '',
    }

    // skip redraws while nothing changes (idle, no fading pulses)
    const key = anim || pulses.length ? '' : `${pose.name}|${this.W}`
    if (key && key === this.drawnKey) return
    this.drawnKey = key

    this.dark.style.opacity = String(dm)
    this.intro.style.opacity = String(ig)
    this.drawGrid(pulses, fieldT)
    this.drawSprite(pose)
    this.drawFx(particles)
  }

  /** Which way Clawd should look to watch the pointer (null: not watching). */
  private gaze(now: number): Gaze | null {
    const p = this.pointer
    if (!p || !this.s.eyesFollow || now - p.at > WATCH_FOR) return null
    const r = this.el.getBoundingClientRect()
    const kk = r.width / REF_W
    const x = (col: number) => r.left + (SPRITE_ORIGIN.x + col * SPRITE_UNIT) * kk
    const y = (row: number) => r.top + (SPRITE_ORIGIN.y + row * SPRITE_UNIT) * kk
    // on its face (or body): look straight at you
    if (p.x >= x(BODY.x0) && p.x < x(BODY.x1) && p.y >= y(BODY.y0) && p.y < y(BODY.y1)) return [0, 0]
    const dx = p.x - x((BODY.x0 + BODY.x1) / 2)
    const dy = p.y - y(BODY.y0 + 3) // eye level
    const a = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4
    return [Math.round(Math.cos(a)), Math.round(Math.sin(a))]
  }

  // ───────────────────────── drawing ─────────────────────────

  private X = (ref: number) => Math.round(ref * this.k)

  private drawGrid(pulses: Pulse[], fieldT: number) {
    const g = this.g
    g.clearRect(0, 0, this.W, this.H)
    if (!pulses.length) return
    computeField(fieldT, pulses, this.field)
    const lit = rgbCsv(this.s.colors.energy)
    const glo = rgbCsv(this.s.colors.effectGlow)
    const X = this.X
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        const a = this.field.lit[i]
        const gl = this.field.glow[i]
        if (!a && !gl) continue
        const x0 = X(c * CELL)
        const x1 = X(c * CELL + CELL_INNER)
        const x2 = X((c + 1) * CELL)
        const y0 = X(r * CELL)
        const y1 = X(r * CELL + CELL_INNER)
        const y2 = X((r + 1) * CELL)
        // coloured under-glow, then bright energy; 1px gutters get a fraction so the grid shows
        for (const [rgb, v] of [
          [glo, gl],
          [lit, a],
        ] as const) {
          if (!v) continue
          g.fillStyle = `rgba(${rgb},${v})`
          g.fillRect(x0, y0, x1 - x0, y1 - y0)
          g.fillStyle = `rgba(${rgb},${v * 0.28})`
          g.fillRect(x1, y0, x2 - x1, y2 - y0)
          g.fillRect(x0, y1, x1 - x0, y2 - y1)
        }
      }
    }
  }

  /** sprite px → device px, with pixel-snapped scale around Clawd's feet */
  private px(col: number, row: number, scale: number): [number, number] {
    const A = { c: 16.5, r: 25 }
    const cc = A.c + (col - A.c) * scale
    const rr = A.r + (row - A.r) * scale
    return [this.X(SPRITE_ORIGIN.x + cc * SPRITE_UNIT), this.X(SPRITE_ORIGIN.y + rr * SPRITE_UNIT)]
  }

  private drawSprite(p: Pose) {
    const s = this.sp
    s.clearRect(0, 0, this.W, this.H)
    const fr = p.frame
    if (!fr) return
    s.globalAlpha = p.opacity
    for (let r = 0; r < fr.rows.length; r++) {
      const row = fr.rows[r]
      for (let c = 0; c < row.length; c++) {
        const ch = row[c]
        if (ch === '.' || ch === ' ') continue
        const col = fr.dx + c + p.ox
        const rw = fr.dy + r + p.oy
        const [x0, y0] = this.px(col, rw, p.scale)
        const [x1, y1] = this.px(col + 1, rw + 1, p.scale)
        s.fillStyle = this.palette[ch] ?? '#f0f'
        s.fillRect(x0, y0, x1 - x0, y1 - y0)
      }
    }
    s.globalAlpha = 1
  }

  private drawFx(list: Particle[]) {
    const f = this.fx
    f.clearRect(0, 0, this.W, this.H)
    for (const p of list) {
      f.globalAlpha = p.alpha
      const main = this.fxColors[p.color] ?? p.color
      const top = p.top ? (this.fxColors[p.top] ?? p.top) : main
      p.glyph.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
          if (row[gx] !== '#') continue
          const [x0, y0] = this.px(p.x + gx, p.y + gy, 1)
          const [x1, y1] = this.px(p.x + gx + 1, p.y + gy + 1, 1)
          f.fillStyle = gy === 0 ? top : main
          f.fillRect(x0, y0, x1 - x0, y1 - y0)
        }
      })
    }
    f.globalAlpha = 1
  }
}

let cssInjected = false
/** Inject the button CSS once into a document or shadow root. */
export function injectButtonCss(target: Document | ShadowRoot = document) {
  if (target === document) {
    if (cssInjected) return
    cssInjected = true
  }
  const style = document.createElement('style')
  style.textContent = BUTTON_CSS
  ;(target === document ? document.head : (target as ShadowRoot)).appendChild(style)
}
