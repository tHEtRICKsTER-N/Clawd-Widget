/**
 * Floating, draggable widget wrapper around ClawdButton.
 *
 *  page mode   – fixed-position element inside a web page (browser extension / demo).
 *                Lives in a shadow root so page CSS can't touch it (and vice versa).
 *                Drag anywhere; near an edge it snaps and docks to it.
 *  window mode – fills a frameless desktop window; dragging moves the window
 *                through the desktop bridge.
 *
 * A click (pointer moved < 5px) plays the animation; a drag only moves.
 */

import type { AnimId } from '../engine/types'
import { BUTTON_CSS, ClawdButton } from './renderer'
import type { Settings } from './settings'

export interface Dock {
  h: 'left' | 'right'
  v: 'top' | 'bottom'
  /** distance from the docked horizontal / vertical edge, px */
  x: number
  y: number
}

export const DEFAULT_DOCK: Dock = { h: 'right', v: 'bottom', x: 20, y: 20 }

const SNAP = 28
const EDGE = 12
const DRAG_THRESHOLD = 5

const ICONS = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.2v9.6L12.8 8z"/></svg>',
  shuffle:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5.7" cy="5.7" r="1.15" fill="currentColor"/><circle cx="8" cy="8" r="1.15" fill="currentColor"/><circle cx="10.3" cy="10.3" r="1.15" fill="currentColor"/></svg>',
  settings:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 5h6M12.5 5h1M2.5 11h1.5M7.5 11h6"/><circle cx="10.5" cy="5" r="1.7"/><circle cx="5.7" cy="11" r="1.7"/></g></svg>',
  close:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.3 4.3l7.4 7.4M11.7 4.3l-7.4 7.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
}

const WIDGET_CSS = `
:host{all:initial}
.cw-wrap{position:relative;display:inline-block;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.cw-slot{touch-action:none;cursor:grab;border-radius:inherit}
.cw-wrap.dragging .cw-slot{cursor:grabbing}
.cw-bar{position:absolute;right:6px;display:flex;gap:2px;padding:3px;border-radius:10px;background:rgba(18,16,26,.86);
  box-shadow:0 2px 10px rgba(0,0,0,.35);opacity:0;visibility:hidden;transform:translateY(4px);z-index:2;
  transition:opacity .15s .25s,transform .15s .25s,visibility 0s linear .4s}
.cw-bar::before{content:'';position:absolute;left:0;right:0;height:10px}
.cw-wrap[data-bar=top] .cw-bar{bottom:calc(100% + 6px)}
.cw-wrap[data-bar=top] .cw-bar::before{top:100%}
.cw-wrap[data-bar=bottom] .cw-bar{top:calc(100% + 6px);transform:translateY(-4px)}
.cw-wrap[data-bar=bottom] .cw-bar::before{bottom:100%}
.cw-wrap:hover .cw-bar,.cw-wrap:focus-within .cw-bar,.cw-wrap.pinned .cw-bar{opacity:1;visibility:visible;transform:none;transition-delay:0s}
.cw-wrap.dragging .cw-bar,.cw-wrap.nobar .cw-bar{display:none}
.cw-bar button{all:unset;box-sizing:border-box;width:26px;height:26px;display:grid;place-items:center;border-radius:7px;color:#e9e6f3;cursor:pointer}
.cw-bar button:hover{background:rgba(255,255,255,.12)}
.cw-bar button:focus-visible{outline:2px solid #b9a6ff;outline-offset:1px}
.cw-bar svg{width:15px;height:15px;display:block}
`

export interface WidgetOptions {
  mode: 'page' | 'window'
  settings: Settings
  dock?: Dock
  /** page mode: dock position changed by the user */
  onDock?: (d: Dock) => void
  onOpenSettings?: () => void
  /** ✕ button (extension: hide on this site; desktop: hide window) */
  onClose?: () => void
  closeLabel?: string
  /** window mode: right-click at (x, y) in window coordinates */
  onContextMenu?: (x: number, y: number) => void
  /** window mode: the host moves the OS window by following the cursor between start and end */
  windowDrag?: { start(): void; end(): void }
  /** page mode: attach to this element instead of document.documentElement */
  container?: HTMLElement
  onPlay?: (id: AnimId) => void
}

export class FloatingWidget {
  readonly host: HTMLElement
  readonly shadow: ShadowRoot
  readonly button: ClawdButton
  private wrap: HTMLDivElement
  private opts: WidgetOptions
  private dock: Dock
  private settings: Settings

  constructor(opts: WidgetOptions) {
    this.opts = opts
    this.settings = opts.settings
    this.dock = { ...(opts.dock ?? DEFAULT_DOCK) }

    const host = document.createElement(opts.mode === 'page' ? 'clawd-widget' : 'div')
    this.host = host
    this.shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = BUTTON_CSS + WIDGET_CSS
    this.shadow.appendChild(style)

    const wrap = document.createElement('div')
    wrap.className = 'cw-wrap'
    this.wrap = wrap
    const bar = document.createElement('div')
    bar.className = 'cw-bar'
    bar.setAttribute('role', 'toolbar')
    const tool = (icon: string, label: string, fn: () => void) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.innerHTML = icon
      b.title = label
      b.setAttribute('aria-label', label)
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        fn()
      })
      b.addEventListener('pointerdown', (e) => e.stopPropagation())
      bar.appendChild(b)
    }
    tool(ICONS.play, 'Play', () => this.button.play())
    tool(ICONS.shuffle, 'Play a random animation', () => this.button.play('random'))
    if (opts.onOpenSettings) tool(ICONS.settings, 'Customize', opts.onOpenSettings)
    if (opts.onClose) tool(ICONS.close, opts.closeLabel ?? 'Hide', opts.onClose)
    wrap.appendChild(bar)

    const slot = document.createElement('div')
    slot.className = 'cw-slot'
    wrap.appendChild(slot)
    this.shadow.appendChild(wrap)

    this.button = new ClawdButton(slot, this.settings, { onPlay: opts.onPlay })
    this.bindPointer(slot)
    this.button.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.button.play()
      }
    })
    if (opts.mode === 'window' && opts.onContextMenu) {
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        opts.onContextMenu!(e.clientX, e.clientY)
      })
    }

    if (opts.mode === 'page') {
      host.setAttribute('style', 'all:initial;position:fixed;z-index:2147483647;display:block;')
      ;(opts.container ?? document.documentElement).appendChild(host)
      this.applyDock()
      window.addEventListener('resize', this.onResize)
    } else {
      host.setAttribute('style', 'position:absolute;left:0;bottom:0;display:block;')
      document.body.appendChild(host)
      wrap.dataset.bar = 'top'
    }
    this.applySettings()
  }

  setSettings(s: Settings) {
    this.settings = s
    this.button.setSettings(s)
    this.applySettings()
    if (this.opts.mode === 'page') this.applyDock()
  }

  /** Put the hover toolbar above or below the button (window mode; page mode decides itself). */
  setBarSide(side: 'top' | 'bottom') {
    this.wrap.dataset.bar = side
  }

  setDock(d: Dock) {
    this.dock = { ...d }
    this.applyDock()
  }

  play(id?: AnimId | 'random') {
    this.button.play(id)
  }

  destroy() {
    window.removeEventListener('resize', this.onResize)
    this.button.destroy()
    this.host.remove()
  }

  private applySettings() {
    this.wrap.classList.toggle('nobar', !this.settings.showToolbar)
  }

  private get size() {
    const w = this.settings.size
    return { w, h: Math.round((w * 104) / 676) }
  }

  /** Keep the widget inside the viewport and place the toolbar on the roomy side. */
  private applyDock() {
    const { w, h } = this.size
    const vw = document.documentElement.clientWidth || window.innerWidth
    const vh = window.innerHeight
    const d = this.dock
    d.x = Math.max(0, Math.min(d.x, vw - w))
    d.y = Math.max(0, Math.min(d.y, vh - h))
    const st = this.host.style
    st.left = st.right = st.top = st.bottom = ''
    st[d.h] = `${d.x}px`
    st[d.v] = `${d.y}px`
    const topSpace = d.v === 'top' ? d.y : vh - d.y - h
    this.wrap.dataset.bar = topSpace > 40 ? 'top' : 'bottom'
  }

  private onResize = () => this.applyDock()

  private bindPointer(slot: HTMLElement) {
    let start: { x: number; y: number; left: number; top: number; id: number } | null = null
    let dragging = false

    slot.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      const r = this.host.getBoundingClientRect()
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, id: e.pointerId }
      dragging = false
      slot.setPointerCapture(e.pointerId)
    })

    slot.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      if (!dragging) {
        dragging = true
        this.wrap.classList.add('dragging')
        this.button.grab()
        // desktop: from here the main process moves the window with the real cursor
        if (this.opts.mode === 'window') this.opts.windowDrag?.start()
      }
      this.button.carry(e.screenX)
      if (this.opts.mode === 'window') return
      const { w, h } = this.size
      const vw = document.documentElement.clientWidth || window.innerWidth
      const left = Math.max(0, Math.min(vw - w, start.left + dx))
      const top = Math.max(0, Math.min(window.innerHeight - h, start.top + dy))
      const st = this.host.style
      st.right = st.bottom = ''
      st.left = `${left}px`
      st.top = `${top}px`
    })

    const end = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      start = null
      this.wrap.classList.remove('dragging')
      if (this.opts.mode === 'window' && dragging) this.opts.windowDrag?.end()
      if (!dragging) {
        if (e.type === 'pointerup') this.button.play()
        return
      }
      dragging = false
      this.button.drop()
      if (this.opts.mode === 'page') this.settle()
    }
    slot.addEventListener('pointerup', end)
    slot.addEventListener('pointercancel', end)
    // capture can be lost without a pointerup (e.g. focus stolen); never leave a drag running
    slot.addEventListener('lostpointercapture', end)
  }

  /** After a drag: dock to the nearest horizontal/vertical edges, snapping when close. */
  private settle() {
    const r = this.host.getBoundingClientRect()
    const vw = document.documentElement.clientWidth || window.innerWidth
    const vh = window.innerHeight
    const h: Dock['h'] = r.left + r.width / 2 < vw / 2 ? 'left' : 'right'
    const v: Dock['v'] = r.top + r.height / 2 < vh / 2 ? 'top' : 'bottom'
    let x = h === 'left' ? r.left : vw - r.right
    let y = v === 'top' ? r.top : vh - r.bottom
    if (x < SNAP) x = EDGE
    if (y < SNAP) y = EDGE
    this.dock = { h, v, x: Math.round(x), y: Math.round(y) }
    this.applyDock()
    this.opts.onDock?.(this.dock)
  }
}
