/**
 * Framework-free renderer for the pixel button. Used by the React demo, the
 * browser extension (inside a shadow root) and the desktop widget.
 *
 * Layers (bottom → top, all clipped by the rounded button):
 *   background (CSS gradient from theme) → intro glow → pressed-dark flash →
 *   grid canvas → sprite canvas → particle canvas → label → CRT scanlines (optional)
 */

import { ANIMATIONS, pickRandom } from '../engine/animations'
import { COSMETIC_PALETTE, wear } from '../engine/cosmetics'
import { lingerFrame, playFrame } from '../engine/frame'
import { CELL, CELL_INNER, COLS, REF_H, REF_W, ROWS, computeField, createField } from '../engine/grid'
import type { Particle } from '../engine/particle'
import { calmPulses, type Pulse } from '../engine/pulses'
import { PALETTE, SPRITE_ORIGIN, SPRITE_UNIT } from '../engine/sprites'
import { darkMix, introGlow } from '../engine/timeline'
import type { AnimationDef, AnimId, Pose } from '../engine/types'
import type { LifeEvent } from './achievements'
import { ensureFont } from './fonts'
import { BugJump } from './game'
import { ClawdLife, type SpriteToClient } from './life'
import { ChipSound } from './sound'
import { COLOR_KEYS, PRESETS, darken, fontFamily, fontWeight, lighten, mix, rgba, rgbCsv, type Colors, type Settings } from './settings'

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
  font-style:normal;text-transform:none;text-shadow:none;letter-spacing:-0.01em;margin:0;padding:0;transition:opacity .25s}
.cw-toast{position:absolute;top:50%;transform:translateY(-50%);white-space:nowrap;pointer-events:none;line-height:1.3;margin:0;padding:0;
  font-family:'Clawd Press Start 2P',monospace;font-weight:400;font-style:normal;letter-spacing:0;text-transform:none;opacity:0;transition:opacity .25s}
.cw-btn.toasting .cw-label,.cw-btn.gaming .cw-label{opacity:0}
.cw-btn.toasting .cw-toast,.cw-btn.gaming .cw-toast{opacity:1}
@media (prefers-reduced-motion:reduce){.cw-label,.cw-toast{transition:none}}
`

const PRESS_COLOR = '#1c1e1b'
/** leftmost reference-px the label may use before running into the sprite */
const LABEL_LEFT = 22
const LABEL_RIGHT = 540
const LABEL_SIZE = 30.5
/** longest nap between frames while nothing changes (a safety net, e.g. for zoom changes) */
const MAX_NAP = 5
/** auto-play: seconds of rest between plays in non-stop mode */
const NONSTOP_GAP = 1.2
/** colour shuffle: seconds a glide from one theme to the next takes */
const GLIDE = 1.5

const sameColors = (a: Colors, b: Colors) => COLOR_KEYS.every((k) => a[k].toLowerCase() === b[k].toLowerCase())
const mixColors = (a: Colors, b: Colors, k: number): Colors =>
  Object.fromEntries(COLOR_KEYS.map((key) => [key, mix(a[key], b[key], k)])) as unknown as Colors

export interface RendererOptions {
  /** called when a single play finishes */
  onEnd?: () => void
  /** called whenever a play starts (with the resolved animation id) */
  onPlay?: (id: AnimId) => void
  /** plays, clicks, pokes, drags, wake-ups and Bug Jump scores, for achievements */
  onEvent?: (e: LifeEvent) => void
  /** the saved Bug Jump high score */
  bestScore?: () => number
  /** fixed device-pixel ratio (exports render at exactly 1:1); default: the screen's */
  dpr?: number
}

/**
 * What an outside tool says is going on, e.g. Claude Code through hooks: working (loops a
 * working animation), waiting for you (waves, then a "!" until you click), done (a
 * celebration), idle (back to resting).
 */
export type Status = 'working' | 'waiting' | 'done' | 'idle'
export const STATUSES: Status[] = ['working', 'waiting', 'done', 'idle']
/** ↑↑↓↓←→←→BA, typed while the button has focus, plays the secret animation */
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']

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
  private toastEl: HTMLSpanElement
  private toasts: string[] = []
  private toastTimer = 0
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
  /** a frame is being drawn; and whether something asked for another frame meanwhile */
  private inTick = false
  private wokenInTick = false
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
  /** opacity of the pressed-dark flash and the intro glow on screen */
  private overlay = { dark: 0, intro: 0 }
  /** how much of the Konami code has been typed */
  private konamiAt = 0
  /** Bug Jump, while it's on */
  private game: BugJump | null = null
  private gameShown = { label: '', over: false }
  /** start Bug Jump once the current play ends (after the secret) */
  private gameAfterPlay = false
  /** the widget is being dragged */
  private dragging = false
  /** auto-play: seconds of quiet so far, and how many this wait lasts */
  private autoWait = 0
  private autoGap = 0
  /** colour shuffle: the colours on screen when they aren't the settings' own, and a glide under way (to null: back to them) */
  private tint: Colors | null = null
  private glide: { from: Colors; to: Colors | null; t: number } | null = null
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
    this.toastEl = span('cw-toast')
    this.toastEl.setAttribute('role', 'status')
    this.crt = span('cw-layer cw-crt')
    this.g = this.cGrid.getContext('2d')!
    this.sp = this.cSprite.getContext('2d')!
    this.fx = this.cFx.getContext('2d')!
    this.el = el
    parent.appendChild(el)
    this.autoGap = this.nextGap()
    this.applySettings()
    window.addEventListener('pointermove', this.onPointerMove, { capture: true, passive: true })
    // keys only while the button itself has focus: never the host page's
    el.addEventListener('keydown', this.onKey)
    this.motion?.addEventListener('change', this.onMotion)
    this.life.calm = this.calm
    this.life.onWake = () => this.opts.onEvent?.({ type: 'wake' })
    this.raf = requestAnimationFrame(this.tick)
  }

  // ───────────────────────── public API ─────────────────────────

  setSettings(s: Settings) {
    const prev = this.s
    this.s = s
    if (s.autoPlay !== prev.autoPlay) this.quiet()
    if (!sameColors(prev.colors, s.colors)) {
      // colours picked by hand: show them right away
      this.tint = null
      this.glide = null
    } else if ((!s.shuffleColors || s.autoPlay <= 0) && (this.tint || this.glide)) {
      // shuffle (or auto-play) turned off: glide back to the chosen colours
      this.glide = { from: { ...this.colors }, to: null, t: 0 }
    }
    this.applySettings(prev)
    this.wake()
  }

  get settings() {
    return this.s
  }

  /** The colours on screen: the settings' own, or where the colour shuffle has got to. */
  get colors(): Colors {
    return this.tint ?? this.s.colors
  }

  /**
   * Play an animation (default: the one chosen in settings; 'random' picks a different one
   * each time). `loop` overrides the settings' play-once / loop for this play; `auto`: an
   * auto-play, which doesn't count towards achievements.
   */
  play(id?: AnimId | 'random', opts: { loop?: boolean; auto?: boolean } = {}) {
    this.wake()
    this.quiet()
    if (this.game) this.stopGame()
    this.gameAfterPlay = false
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
    if (!opts.auto) this.opts.onEvent?.({ type: 'play', id: resolved, hour: new Date().getHours() })
  }

  /**
   * A click at (x, y) in client px. Landing on a resting Clawd it's a poke (squish, heart,
   * combo); anywhere else, or while playing, it plays the animation.
   */
  click(x: number, y: number) {
    this.wake()
    this.quiet()
    this.unlockSound()
    if (this.game) {
      this.game.jump()
      return
    }
    this.opts.onEvent?.({ type: 'click' })
    if (this.s.pokes && this.mode === 'idle' && !this.controlled && this.life.hits(x, y)) this.opts.onEvent?.({ type: 'poke', combo: this.life.poke() })
    else this.play()
  }

  /** Start Bug Jump (see game.ts): click / Space / ↑ jumps, Escape quits. */
  startGame() {
    this.wake()
    this.unlockSound()
    this.mode = 'idle'
    this.linger = null
    this.gameAfterPlay = false
    this.life.reset()
    this.game = new BugJump(this.opts.bestScore?.() ?? 0)
    this.gameShown = { label: '', over: false }
    this.el.classList.add('gaming')
    // keys go to the focused button
    this.el.focus({ preventScroll: true })
  }

  stopGame() {
    if (!this.game) return
    this.game = null
    this.el.classList.remove('gaming')
    this.wake()
    // achievement toasts waited for the game to end
    if (this.toasts.length && !this.toastTimer) this.nextToast()
  }

  get gaming() {
    return !!this.game
  }

  /** A short message in the label's place for a few seconds (e.g. an unlocked achievement); queued. */
  toast(text: string) {
    this.toasts.push(text)
    if (!this.toastTimer) this.nextToast()
  }

  private nextToast() {
    // not over the score while a game is on: they wait (see stopGame)
    if (this.game) {
      this.toastTimer = 0
      return
    }
    const text = this.toasts.shift()
    if (text === undefined) {
      this.el.classList.remove('toasting')
      this.toastTimer = 0
      return
    }
    this.toastEl.textContent = text
    this.fitToast()
    void ensureFont('press').then(() => this.fitToast())
    this.el.classList.add('toasting')
    if (this.s.sound) this.chip().fanfare()
    this.toastTimer = window.setTimeout(() => this.nextToast(), 3600)
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
    this.quiet()
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
    this.quiet()
    this.dragging = on
    if (on) this.opts.onEvent?.({ type: 'drag' })
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
    clearTimeout(this.toastTimer)
    this.sound?.destroy()
    window.removeEventListener('pointermove', this.onPointerMove, { capture: true })
    this.motion?.removeEventListener('change', this.onMotion)
    this.el.remove()
  }

  private onPointerMove = (e: PointerEvent) => this.lookAt(e.clientX, e.clientY)

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (this.game) {
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        e.preventDefault()
        this.unlockSound()
        this.game.jump()
        return
      }
      if (k === 'escape') {
        e.preventDefault()
        this.stopGame()
        return
      }
    }
    // Shift (for capital B A) and friends don't count as keys of the code
    if (k === 'shift' || k === 'control' || k === 'alt' || k === 'meta' || k === 'capslock') return
    if (k === KONAMI[this.konamiAt]) this.konamiAt++
    // a wrong key starts over, but a third ↑ still leaves "↑↑" typed
    else this.konamiAt = k !== KONAMI[0] ? 0 : this.konamiAt === 2 ? 2 : 1
    // keys that are part of the code don't also scroll the page
    if (this.konamiAt > 0) e.preventDefault()
    if (this.konamiAt === KONAMI.length) {
      this.konamiAt = 0
      this.unlockSound()
      // the secret, then the game
      this.play('konami', { loop: false })
      this.gameAfterPlay = true
    }
  }

  private onMotion = () => {
    this.calm = !!this.motion?.matches
    this.life.calm = this.calm
    this.drawn = null
    this.wake()
  }

  // ───────────────────────── settings → DOM ─────────────────────────

  private applySettings(prev?: Settings) {
    const s = this.s
    const width = s.size
    const height = Math.round((width * REF_H) / REF_W)
    const kk = width / REF_W
    const st = this.el.style
    st.width = `${width}px`
    st.height = `${height}px`
    st.borderRadius = `${32 * kk}px`
    this.el.setAttribute('aria-label', s.text || 'Clawd button')

    this.applyColors()

    const L = this.label.style
    L.left = `${LABEL_LEFT * kk}px`
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

    this.resize()
    const fontChanged = !prev || prev.font !== s.font || prev.customFont !== s.customFont || prev.bold !== s.bold
    this.fitLabel()
    if (fontChanged) void ensureFont(s.font).then(() => this.fitLabel())
    this.drawn = null
  }

  /** Everything coloured: the background layers, the label, Clawd and the effects. */
  private applyColors() {
    const c = this.colors
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
    this.label.style.color = c.text
    this.toastEl.style.color = c.text

    this.palette = { ...PALETTE, ...COSMETIC_PALETTE, O: c.bot, o: darken(c.bot, 0.2) }
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
    this.drawn = null
  }

  private fitToast() {
    const kk = this.s.size / REF_W
    const T = this.toastEl.style
    T.left = `${LABEL_LEFT * kk}px`
    T.color = this.colors.text
    const base = 14 * kk
    T.fontSize = `${base}px`
    const avail = (LABEL_RIGHT - LABEL_LEFT) * kk
    const w = this.toastEl.scrollWidth
    if (w > avail && w > 0) T.fontSize = `${Math.max(6, (base * avail) / w)}px`
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
    const dpr = this.screenDpr()
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
    this.inTick = true
    this.wokenInTick = false
    let rest = 0
    try {
      rest = this.step(now, dt)
    } finally {
      this.inTick = false
    }
    // something started during the frame (a play from onEnd, the game after the secret): no nap
    this.schedule(this.wokenInTick ? 0 : rest)
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
    // mid-frame: the frame loop schedules the next one itself (a second rAF here would start a second loop)
    if (this.inTick) {
      this.wokenInTick = true
      return
    }
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
    if (this.mode === 'idle' && this.autoReady()) this.autoWait += dt
    this.life.advance(dt)
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Auto-play is on and may start something now: resting on a visible page, no game, drag or waiting. */
  private autoReady(): boolean {
    if (this.s.autoPlay <= 0 || this.controlled || this.game || this.gameAfterPlay || this.dragging || this.life.waiting) return false
    return typeof document === 'undefined' || document.visibilityState !== 'hidden'
  }

  /** Something happened (a play, a click, a drag): the auto-play wait starts over. */
  private quiet() {
    this.autoWait = 0
    this.autoGap = this.nextGap()
  }

  /** Glide into a random theme preset (never the one already on screen). */
  private shuffle() {
    const now = this.colors
    const pool = PRESETS.filter((p) => !sameColors(p.colors, now))
    const next = pool[Math.floor(Math.random() * pool.length)]
    this.glide = { from: { ...now }, to: next.colors, t: 0 }
  }

  /** How long the next auto-play waits: about the chosen time, varied ±40% so it doesn't feel mechanical. */
  private nextGap(): number {
    const v = this.s.autoPlay
    return v <= 1 ? NONSTOP_GAP : v * (0.6 + 0.8 * Math.random())
  }

  /** Advance and draw one frame; returns seconds until anything can change by itself (0: moving). */
  private step(now: number, dt: number): number {
    if (this.screenDpr() !== this.dpr) this.resize()

    let anim: AnimationDef | null = null
    let t = 0
    let fieldT = 0
    let pulses: Pulse[] = []
    let particles: Particle[] = []
    let pose: Pose
    let rest = 0

    if (this.glide) this.stepGlide(dt * this.speed)
    if (this.game && !this.controlled) return this.stepGame(this.game, dt)

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
        if (this.gameAfterPlay) this.startGame()
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
      // auto-play: after a quiet spell, something at random (it starts on the next frame)
      if (!this.controlled && this.autoReady()) {
        this.autoWait += dt * this.speed
        if (this.autoWait >= this.autoGap) {
          if (this.s.shuffleColors) this.shuffle()
          this.play(pickRandom(this.lastAnimId), { loop: false, auto: true })
        }
        else rest = Math.min(rest, this.autoGap - this.autoWait)
      }
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

    this.overlay = { dark: dm, intro: ig }
    this.dark.style.opacity = String(dm)
    this.intro.style.opacity = String(ig)
    this.drawGrid(pulses, fieldT)
    this.drawSprite(pose)
    this.drawFx(particles)
    return this.glide ? 0 : rest
  }

  /** Colour shuffle: one frame further along the glide (smoothstep), all colours mixed together. */
  private stepGlide(dt: number) {
    const g = this.glide!
    g.t += dt
    const k = Math.min(1, g.t / GLIDE)
    const to = g.to ?? this.s.colors
    this.tint = mixColors(g.from, to, k * k * (3 - 2 * k))
    if (k >= 1) {
      this.tint = g.to
      this.glide = null
    }
    this.applyColors()
  }

  /** A frame of Bug Jump: its pose, bugs and ✓s, pulses and the score in the label's place. */
  private stepGame(game: BugJump, dt: number): number {
    const f = game.step(dt * this.speed)
    if (f.label !== this.gameShown.label) {
      this.gameShown.label = f.label
      this.toastEl.textContent = f.label
      this.fitToast()
      void ensureFont('press').then(() => this.fitToast())
    }
    if (game.over && !this.gameShown.over) this.opts.onEvent?.({ type: 'game', score: game.score })
    this.gameShown.over = game.over
    if (game.done) this.stopGame()
    const pulses = this.calm ? calmPulses(f.pulses) : f.pulses
    this.playSounds(pulses, game.t, dt * this.speed)
    this.stateCache = { mode: this.mode, anim: null, t: game.t, pose: f.pose.name ?? '' }
    this.drawn = null
    this.dark.style.opacity = '0'
    this.intro.style.opacity = '0'
    this.drawGrid(pulses, game.t)
    this.drawSprite(f.pose)
    this.drawFx(f.particles)
    return 0
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

  private screenDpr() {
    return this.opts.dpr ?? Math.max(1, Math.round(window.devicePixelRatio || 1))
  }

  /** Draw the frame at time t of an animation right now (for exports; see composite). */
  renderAt(t: number, anim: AnimId) {
    this.controlled = { t, anim }
    this.step(performance.now(), 0)
  }

  /**
   * Paint the whole button as it looks now onto ctx (sized W × H device px): the CSS layers
   * (base colour, gradients, intro glow, pressed flash), the three canvases, the label and
   * the CRT overlay, clipped to the rounded corners. Used to export frames.
   */
  composite(ctx: CanvasRenderingContext2D) {
    const { W, H } = this
    const s = this.s
    const c = this.colors
    const bgc = c.background
    const kk = this.k
    ctx.save()
    ctx.clearRect(0, 0, W, H)
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, 32 * kk)
    ctx.clip()
    // an ellipse-shaped radial gradient (CSS "rx ry at cx cy"), stops given as [offset, colour]
    const ellipse = (cx: number, cy: number, rx: number, ry: number, stops: [number, string][]) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(rx, ry)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      for (const [o, col] of stops) g.addColorStop(o, col)
      ctx.fillStyle = g
      ctx.fillRect(-cx / rx, -cy / ry, W / rx, H / ry)
      ctx.restore()
    }
    ctx.fillStyle = darken(bgc, 0.3)
    ctx.fillRect(0, 0, W, H)
    const lin = ctx.createLinearGradient(0, 0, W, 0)
    ;(
      [
        [0, darken(bgc, 0.36)],
        [0.22, darken(bgc, 0.28)],
        [0.44, darken(bgc, 0.2)],
        [0.64, darken(bgc, 0.08)],
        [0.78, bgc],
        [0.9, lighten(bgc, 0.03)],
        [1, darken(bgc, 0.06)],
      ] as [number, string][]
    ).forEach(([o, col]) => lin.addColorStop(o, col))
    ctx.fillStyle = lin
    ctx.fillRect(0, 0, W, H)
    ellipse(0.888 * W, H / 2, 0.125 * W, 1.05 * H, [
      [0, c.glow],
      [0.42, rgba(c.glow, 0.62)],
      [1, rgba(c.glow, 0)],
    ])
    if (this.overlay.intro > 0) {
      ctx.globalAlpha = this.overlay.intro
      ctx.fillStyle = rgba(lighten(bgc, 0.35), 0.24)
      ctx.fillRect(0, 0, W, H)
      ellipse(0.888 * W, H / 2, 0.16 * W, 1.2 * H, [
        [0, rgba(lighten(c.glow, 0.35), 0.3)],
        [1, rgba(lighten(c.glow, 0.35), 0)],
      ])
      ctx.globalAlpha = 1
    }
    if (this.overlay.dark > 0) {
      ctx.globalAlpha = this.overlay.dark
      ctx.fillStyle = PRESS_COLOR
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    }
    ctx.drawImage(this.cGrid, 0, 0)
    ctx.drawImage(this.cSprite, 0, 0)
    ctx.drawImage(this.cFx, 0, 0)
    // the label, where the browser laid it out: CSS puts the baseline at the box top plus
    // half the leading (line-height minus the font's ascent + descent) plus the ascent
    const fs = parseFloat(this.label.style.fontSize) * this.dpr
    const box = this.label.getBoundingClientRect()
    const btn = this.el.getBoundingClientRect()
    ctx.font = `${fontWeight(s)} ${fs}px ${fontFamily(s)}`
    ctx.fillStyle = c.text
    ctx.textBaseline = 'alphabetic'
    // like the CSS label's letter-spacing: -0.01em (where canvas supports it)
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.01 * fs}px`
    const m = ctx.measureText(s.text)
    const top = (box.top - btn.top) * this.dpr
    const lead = (box.height * this.dpr - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2
    ctx.fillText(s.text, (box.left - btn.left) * this.dpr, top + lead + m.fontBoundingBoxAscent)
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    if (s.crt) {
      const line = Math.max(2, Math.round((3 * s.size) / 340)) * this.dpr
      ctx.fillStyle = 'rgba(0,0,0,.3)'
      for (let y = 0; y < H; y += line) ctx.fillRect(0, y, W, line / 3)
      ellipse(W / 2, H / 2, 0.75 * W, 0.95 * H, [
        [0.6, 'rgba(0,0,0,0)'],
        [1, 'rgba(0,0,0,.35)'],
      ])
    }
    ctx.restore()
  }

  /** Size of the canvases, device px. */
  get pixelSize() {
    return { width: this.W, height: this.H }
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
    const lit = rgbCsv(this.colors.energy)
    const glo = rgbCsv(this.colors.effectGlow)
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
    // whatever Clawd is wearing, placed on this frame's head
    if (this.s.cosmetic !== 'none') {
      for (const [x, y, ch] of wear(this.s.cosmetic, fr)) {
        const [x0, y0] = this.px(x + p.ox, y + p.oy, p.scale)
        const [x1, y1] = this.px(x + p.ox + 1, y + p.oy + 1, p.scale)
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
