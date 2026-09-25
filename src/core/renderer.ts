/**
 * Framework-free renderer for the pixel button. Used by the React demo, the
 * browser extension (inside a shadow root) and the desktop widget.
 *
 * Layers (bottom → top, all clipped by the rounded button):
 *   background (CSS gradient from theme) → intro glow → pressed-dark flash →
 *   grid canvas → sprite canvas → particle canvas → label → CRT scanlines (optional)
 */

import { ANIMATIONS, pickRandom } from '../engine/animations'
import { lingerFrame, playFrame } from '../engine/frame'
import { CELL, CELL_INNER, COLS, REF_H, REF_W, ROWS, computeField, createField } from '../engine/grid'
import type { Particle } from '../engine/particle'
import { calmPulses, type Pulse } from '../engine/pulses'
import { PALETTE, SPRITE_ORIGIN, SPRITE_UNIT } from '../engine/sprites'
import { darkMix, introGlow } from '../engine/timeline'
import type { AnimationDef, AnimId, Pose } from '../engine/types'
import { ensureFont } from './fonts'
import { ClawdLife, type SpriteToClient } from './life'
import { ChipSound } from './sound'
import { darken, fontFamily, fontWeight, lighten, mix, rgba, rgbCsv, type Settings } from './settings'

export const BUTTON_CSS = `
.cw-btn{position:relative;display:block;overflow:hidden;isolation:isolate;cursor:pointer;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;outline:none;box-sizing:border-box;margin:0;padding:0;border:0;contain:layout paint}
.cw-btn:focus-visible{box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.cw-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block}
.cw-canvas{image-rendering:pixelated;image-rendering:crisp-edges}
.cw-dark{background:#1c1e1b;opacity:0}
.cw-intro{opacity:0}
.cw-crt{display:none}
.cw-btn.crt .cw-crt{display:block}
.cw-label{position:absolute;top:50%;transform:translateY(-52%);white-space:nowrap;pointer-events:none;line-height:1;
  font-style:normal;text-transform:none;text-shadow:none;letter-spacing:-0.01em;margin:0;padding:0}
`

const PRESS_COLOR = '#1c1e1b'
/** leftmost reference-px the label may use before running into the sprite */
const LABEL_LEFT = 22
const LABEL_RIGHT = 540
const LABEL_SIZE = 30.5
/** longest nap between frames while nothing changes (a safety net, e.g. for zoom changes) */
const MAX_NAP = 5

export interface RendererOptions {
  /** called when a single play finishes */
  onEnd?: () => void
  /** called whenever a play starts (with the resolved animation id) */
  onPlay?: (id: AnimId) => void
}

/**
 * What an outside tool says is going on, e.g. Claude Code through hooks: working (loops a
 * working animation), waiting for you (waves, then a "!" until you click), done (a
 * celebration), idle (back to resting).
 */
export type Status = 'working' | 'waiting' | 'done' | 'idle'
export const STATUSES: Status[] = ['working', 'waiting', 'done', 'idle']
/** loops while the status is 'working' */
const WORKING_ANIM: AnimId = 'think'

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
  private crt: HTMLSpanElement
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
  /** timer while the loop naps until the next scheduled change */
  private nap = 0
  /** longest dt the next frame may use: 0.1 s, or the nap's length after a nap */
  private maxDt = 0.1
  private last = 0
  private speed = 1

  private mode: 'idle' | 'play' = 'idle'
  private anim: AnimationDef | null = null
  /** this play loops (true) or plays once (false) whatever the settings say; null: settings decide */
  private playLoop: boolean | null = null
  private lastAnimId: AnimId | null = null
  private playT = 0
  private idleT = 0
  private linger: { anim: AnimationDef; end: number; t: number } | null = null
  private controlled: { t: number; anim: AnimId } | null = null
  /** the still pose on screen, to skip redrawing it (null: redraw) */
  private drawn: Pose | null = null
  private palette: Record<string, string> = { ...PALETTE }
  private fxColors: Record<string, string> = {}
  private stateCache: RendererState = { mode: 'idle', anim: null, t: 0, pose: '' }
  /** what Clawd does between plays (watching, dragging, pokes) */
  private life = new ClawdLife(() => this.spriteToClient())
  /** chiptune sounds, made on first use while settings.sound is on */
  private sound: ChipSound | null = null
  /** seconds of frames so far (scaled by speed): when each pulse sounded is kept on this clock */
  private soundClock = 0
  /** pulses that have sounded recently, so each sounds once */
  private heard: { kind: string; seed: number; at: number }[] = []
  /** the system asks for reduced motion: calmer pulses, no tap flash, calmer eyes */
  private motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  private calm = !!this.motion?.matches

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
    this.crt = span('cw-layer cw-crt')
    this.g = this.cGrid.getContext('2d')!
    this.sp = this.cSprite.getContext('2d')!
    this.fx = this.cFx.getContext('2d')!
    this.el = el
    parent.appendChild(el)
    this.applySettings()
    window.addEventListener('pointermove', this.onPointerMove, { capture: true, passive: true })
    this.motion?.addEventListener('change', this.onMotion)
    this.life.calm = this.calm
    this.raf = requestAnimationFrame(this.tick)
  }

  // ───────────────────────── public API ─────────────────────────

  setSettings(s: Settings) {
    const prev = this.s
    this.s = s
    this.applySettings(prev)
    this.wake()
  }

  get settings() {
    return this.s
  }

  /**
   * Play an animation (default: the one chosen in settings; 'random' picks a different one
   * each time). `loop` overrides the settings' play-once / loop for this play.
   */
  play(id?: AnimId | 'random', opts: { loop?: boolean } = {}) {
    this.wake()
    this.playLoop = opts.loop ?? null
    const want = id ?? this.s.animation
    const resolved: AnimId = want === 'random' ? pickRandom(this.lastAnimId) : want
    this.anim = ANIMATIONS[resolved]
    this.lastAnimId = resolved
    this.mode = 'play'
    this.playT = 0
    this.linger = null
    this.life.reset()
    this.opts.onPlay?.(resolved)
  }

  /**
   * A click at (x, y) in client px. Landing on a resting Clawd it's a poke (squish, heart,
   * combo); anywhere else, or while playing, it plays the animation.
   */
  click(x: number, y: number) {
    this.wake()
    this.unlockSound()
    if (this.s.pokes && this.mode === 'idle' && !this.controlled && this.life.hits(x, y)) this.life.poke()
    else this.play()
  }

  /**
   * Browsers only allow audio after a user gesture: hosts call this from their click
   * handlers. `force` also when sound is being switched on by this very click.
   */
  unlockSound(force = false) {
    if (force || this.s.sound) this.chip().unlock()
  }

  /** Show a status from an outside tool (see Status). */
  setStatus(status: Status) {
    if (status === 'working') this.play(WORKING_ANIM, { loop: true })
    else if (status === 'waiting') this.play('hello', { loop: false })
    else if (status === 'done') this.play('jump', { loop: false })
    else this.stop()
    // after play(), which counts as company and would clear it
    this.life.waiting = status === 'waiting'
  }

  /** Return to the resting state. */
  stop() {
    this.wake()
    if (this.mode === 'play' && this.anim) this.linger = { anim: this.anim, end: Math.min(this.playT, this.anim.duration), t: 0 }
    this.mode = 'idle'
  }

  get playing() {
    return this.mode === 'play'
  }

  setSpeed(x: number) {
    this.speed = x
    this.wake()
  }

  /**
   * The widget is being dragged (true) or was just let go (false). While resting, Clawd
   * dangles during the drag and lands with a thud that shakes the grid.
   */
  setDragging(on: boolean) {
    this.wake()
    if (!on) this.life.drag(false)
    else if (this.s.dragReact && this.mode === 'idle' && !this.controlled) this.life.drag(true)
  }

  /** Dev/testing: render a fixed time of one animation (null = back to normal). */
  setControlled(t: number | null, anim: AnimId = 'guitar') {
    this.controlled = t === null ? null : { t, anim }
    this.wake()
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
    // the pointer only matters to eyes that follow it and to dozing off / waking up
    if (this.s.eyesFollow || this.s.idleAntics) this.wake()
    this.life.lookAt(x, y)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.nap)
    this.sound?.destroy()
    window.removeEventListener('pointermove', this.onPointerMove, { capture: true })
    this.motion?.removeEventListener('change', this.onMotion)
    this.el.remove()
  }

  private onPointerMove = (e: PointerEvent) => this.lookAt(e.clientX, e.clientY)

  private onMotion = () => {
    this.calm = !!this.motion?.matches
    this.life.calm = this.calm
    this.drawn = null
    this.wake()
  }

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

    // CRT: dark scanlines every few px (scaled with the size) and a soft vignette
    this.el.classList.toggle('crt', s.crt)
    const line = Math.max(2, Math.round((3 * width) / 340))
    this.crt.style.background = [
      `repeating-linear-gradient(to bottom, rgba(0,0,0,.3) 0 ${line / 3}px, transparent ${line / 3}px ${line}px)`,
      'radial-gradient(ellipse 75% 95% at 50% 50%, transparent 60%, rgba(0,0,0,.35) 100%)',
    ].join(',')

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
    this.drawn = null
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
    this.drawn = null
  }

  // ───────────────────────── frame loop ─────────────────────────

  private tick = (now: number) => {
    this.raf = 0
    const dt = this.last ? Math.min(this.maxDt, (now - this.last) / 1000) : 0
    this.last = now
    this.maxDt = 0.1
    this.schedule(this.step(now, dt))
  }

  /**
   * Next frame: right away while anything moves. At rest, nap until the next scheduled
   * change (a blink, the end of watching the pointer, an antic); input wakes it sooner.
   */
  private schedule(rest: number) {
    if (rest < 0.02) {
      this.raf = requestAnimationFrame(this.tick)
      return
    }
    const secs = Math.min(rest, MAX_NAP)
    this.maxDt = secs + 0.1
    this.nap = window.setTimeout(() => {
      this.nap = 0
      this.raf = requestAnimationFrame(this.tick)
    }, secs * 1000)
  }

  /**
   * Something happened (input, settings, a play): make sure a frame comes soon. Called
   * before handling input, so that during a nap the clocks first catch up with now and
   * whatever the input starts is timed from now.
   */
  private wake() {
    if (!this.nap) {
      if (!this.raf) this.raf = requestAnimationFrame(this.tick)
      return
    }
    clearTimeout(this.nap)
    this.nap = 0
    const now = performance.now()
    const dt = Math.min(this.maxDt, (now - this.last) / 1000) * this.speed
    this.last = now
    this.maxDt = 0.1
    this.idleT += dt
    this.soundClock += dt
    this.life.advance(dt)
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Advance and draw one frame; returns seconds until anything can change by itself (0: moving). */
  private step(now: number, dt: number): number {
    if (Math.max(1, Math.round(window.devicePixelRatio || 1)) !== this.dpr) this.resize()

    let anim: AnimationDef | null = null
    let t = 0
    let fieldT = 0
    let pulses: Pulse[] = []
    let particles: Particle[] = []
    let pose: Pose
    let rest = 0

    if (this.controlled) {
      anim = ANIMATIONS[this.controlled.anim]
      t = this.controlled.t
    } else if (this.mode === 'play' && this.anim) {
      this.playT += dt * this.speed
      const loop = this.playLoop ?? this.s.playMode === 'loop'
      if (!loop && this.playT >= this.anim.duration) {
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
      if (this.linger) {
        this.linger.t += dt * this.speed
        const f = lingerFrame(this.linger.anim, this.linger.end, this.linger.t)
        if (!f) this.linger = null
        else {
          pulses = f.pulses
          fieldT = f.fieldT
        }
      }
      const life = this.life.frame(dt * this.speed, now, this.idleT, this.s, fieldT)
      pose = life.pose
      particles = life.particles
      if (life.pulses.length) pulses = pulses.concat(life.pulses)
      // naps are timed in real seconds, so only at normal speed
      if (!this.linger && this.speed === 1) rest = life.rest
    }

    // reduced motion: no tap flash, and pulses thinned to at most 3 a second and toned down
    const press = anim?.pressIntro && this.s.pressFlash && !this.calm ? t : Infinity
    if (this.calm && pulses.length) pulses = calmPulses(pulses)
    this.playSounds(pulses, fieldT, dt * this.speed)
    const dm = darkMix(press)
    const ig = introGlow(press)
    this.stateCache = {
      mode: this.controlled ? 'controlled' : this.mode,
      anim: anim?.id ?? null,
      t,
      pose: pose.name ?? '',
    }

    // skip redraws while nothing changes (idle, no fading pulses or particles, same pose)
    const still = !anim && !pulses.length && !particles.length
    const d = this.drawn
    if (still && d && d.frame === pose.frame && d.ox === pose.ox && d.oy === pose.oy && d.scale === pose.scale && d.opacity === pose.opacity) return rest
    this.drawn = still ? pose : null

    this.dark.style.opacity = String(dm)
    this.intro.style.opacity = String(ig)
    this.drawGrid(pulses, fieldT)
    this.drawSprite(pose)
    this.drawFx(particles)
    return rest
  }

  private chip(): ChipSound {
    return (this.sound ??= new ChipSound())
  }

  /**
   * A sound for every pulse as it starts. A pulse can be listed a few ms before or after
   * its (jittered) start, so each one is remembered by kind, seed and start time on a
   * steady clock and sounds once. Start times carry across loop seams and into the fade-out
   * after a play, so nothing sounds twice; a pulse first seen long after it started (sound
   * switched on mid-play) stays quiet.
   */
  private playSounds(pulses: Pulse[], fieldT: number, step: number) {
    const now = (this.soundClock += step)
    if (this.heard.length) this.heard = this.heard.filter((h) => now - h.at < 3)
    if (!this.s.sound || this.controlled) return
    for (const p of pulses) {
      const age = fieldT - p.t0
      if (age < 0 || age > 0.25) continue
      const at = now - age
      if (this.heard.some((h) => h.seed === p.seed && h.kind === p.kind && Math.abs(h.at - at) < 0.05)) continue
      this.heard.push({ kind: p.kind, seed: p.seed, at })
      const chip = this.chip()
      chip.volume = this.s.volume
      chip.pulse(p.kind, p.strength, p.seed)
    }
  }

  /** Sprite px → client px for where the button is right now. */
  private spriteToClient(): SpriteToClient {
    const r = this.el.getBoundingClientRect()
    const kk = r.width / REF_W
    return (col, row) => [r.left + (SPRITE_ORIGIN.x + col * SPRITE_UNIT) * kk, r.top + (SPRITE_ORIGIN.y + row * SPRITE_UNIT) * kk]
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
