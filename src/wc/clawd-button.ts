/**
 * <clawd-button>: the Clawd button as a custom element, for any page (a game's Play button on
 * itch.io, a landing page, a blog). Everything is set with attributes, the same names as the
 * OBS overlay's URL (core/overlay.ts):
 *
 *   <clawd-button text="Play" theme="synthwave" anim="levelup" href="game/index.html"></clawd-button>
 *
 * Click (or Enter / Space) plays the animation. With `href`, the page goes there once that play
 * ends (a second click goes straight away). Events: `clawd-play` and `clawd-end`, with the
 * animation id in `detail.anim`. Methods: play(anim?), stop(), setStatus(state).
 */

import { settingsFrom } from '../core/overlay'
import { ClawdButton, STATUSES, injectButtonCss, type Status } from '../core/renderer'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { ANIMATIONS } from '../engine/animations'
import type { AnimId } from '../engine/types'

/** defaults for the element: a Play button that plays wherever it's clicked */
const BASE: Settings = { ...DEFAULT_SETTINGS, text: 'Play', pokes: false, showToolbar: false }

const SETTING_ATTRS = ['text', 'theme', 'font', 'bold', 'size', 'anim', 'loop', 'sound', 'volume', 'wear', 'crt', 'idle', 'eyes', 'blink', 'pokes', 'flash']

const HOST_CSS = `:host{display:inline-block;vertical-align:middle;line-height:0;-webkit-tap-highlight-color:transparent}:host([hidden]){display:none}`

// server-side rendering (Next.js, Astro, …) imports this without a DOM: define nothing there
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement

export class ClawdButtonElement extends Base {
  static observedAttributes = [...SETTING_ATTRS, 'state']

  private b: ClawdButton | null = null
  /** a click started this play: follow `href` when it ends */
  private armed = false
  /** what's playing (or just played), for the events */
  private anim: AnimId | null = null

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  /** the renderer underneath, for anything the attributes don't cover */
  get button(): ClawdButton | null {
    return this.b
  }

  connectedCallback() {
    if (this.b) return
    const root = this.shadowRoot!
    injectButtonCss(root)
    const style = document.createElement('style')
    style.textContent = HOST_CSS
    root.append(style)
    this.b = new ClawdButton(root, this.readSettings(), {
      onPlay: (anim) => {
        this.anim = anim
        this.emit('clawd-play', anim)
      },
      onEnd: () => {
        this.emit('clawd-end', this.anim)
        if (this.armed) this.follow()
      },
    })
    this.b.el.addEventListener('click', this.onClick)
    this.b.el.addEventListener('keydown', this.onKey)
    const st = this.getAttribute('state')
    if (STATUSES.includes(st as Status)) this.b.setStatus(st as Status)
  }

  disconnectedCallback() {
    this.b?.destroy()
    this.b = null
    this.armed = false
    this.shadowRoot!.replaceChildren()
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (!this.b || old === value) return
    if (name === 'state') {
      if (STATUSES.includes(value as Status)) this.b.setStatus(value as Status)
    } else this.b.setSettings(this.readSettings())
  }

  /** Play an animation (default: the `anim` attribute). */
  play(anim?: AnimId | 'random') {
    this.b?.play(anim && (anim === 'random' || anim in ANIMATIONS) ? anim : undefined)
  }

  /** Back to resting. */
  stop() {
    this.armed = false
    this.b?.stop()
  }

  /** working (loops Thinking), waiting (waves, then "!"), done (Jump Party) or idle. */
  setStatus(state: Status) {
    this.b?.setStatus(state)
  }

  private readSettings(): Settings {
    return settingsFrom((k) => this.getAttribute(k), BASE)
  }

  private onClick = (e: MouseEvent) => {
    const b = this.b
    if (!b) return
    // impatient: a second click while the linked play runs goes now
    if (this.armed && b.playing && this.getAttribute('href')) return this.follow()
    b.click(e.clientX, e.clientY)
    this.armed = b.playing && !b.gaming
  }

  private onKey = (e: KeyboardEvent) => {
    const b = this.b
    if (!b || b.gaming || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    if (this.armed && b.playing && this.getAttribute('href')) return this.follow()
    b.unlockSound()
    b.play()
    this.armed = true
  }

  private follow() {
    this.armed = false
    const href = this.getAttribute('href')
    if (!href) return
    const target = this.getAttribute('target')
    if (target && target !== '_self') window.open(href, target, target === '_blank' ? 'noopener' : '')
    else window.location.assign(href)
  }

  private emit(type: 'clawd-play' | 'clawd-end', anim: AnimId | null) {
    this.dispatchEvent(new CustomEvent(type, { detail: { anim }, bubbles: true, composed: true }))
  }
}

/** Register the element (the package entry does this for you). */
export function defineClawdButton(tag = 'clawd-button') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) customElements.define(tag, class extends ClawdButtonElement {})
}

declare global {
  interface HTMLElementTagNameMap {
    'clawd-button': ClawdButtonElement
  }
}
