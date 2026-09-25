// Desktop widget window: the floating button inside a transparent frameless window.
import { desktopStore, type DesktopLayout } from '../../src/core/store'
import { STATUSES, type Status } from '../../src/core/renderer'
import { FloatingWidget } from '../../src/core/widget'
import type { AnimId } from '../../src/engine/types'

// must match desktop/main.cjs
const PAD = 10
const BAR = 38

async function main() {
  const api = window.clawdDesktop!
  const store = desktopStore()
  const [settings, layout] = await Promise.all([store.load(), api.getLayout()])
  const w = new FloatingWidget({
    mode: 'window',
    settings,
    onOpenSettings: () => api.openSettings(),
    onClose: () => api.hide(),
    closeLabel: 'Hide (click the tray icon to bring it back)',
    onContextMenu: (x, y) => api.showMenu(x, y),
    windowDrag: { start: api.dragStart, end: api.dragEnd },
  })

  // The main process puts the toolbar strip above the button, or below it when the
  // button sits near the top of the screen; lay the page out to match.
  const applyLayout = (l: DesktopLayout) => {
    w.setBarSide(l.bar)
    const st = w.host.style
    st.left = `${PAD}px`
    st.bottom = ''
    st.top = `${l.bar === 'top' ? BAR + PAD : PAD}px`
  }
  applyLayout(layout)
  api.onLayout(applyLayout)

  // for debugging from devtools and for tests
  ;(window as unknown as { clawdWidget: FloatingWidget }).clawdWidget = w

  store.subscribe((s) => w.setSettings(s))
  api.onCursor((x, y) => w.button.lookAt(x, y))
  api.onCommand((cmd, arg) => {
    if (cmd === 'play') w.play(arg as AnimId | 'random' | undefined)
    else if (cmd === 'state' && STATUSES.includes(arg as Status)) w.button.setStatus(arg as Status)
  })

  // Transparent parts of the window let clicks through to whatever is behind it.
  const wrap = w.shadow.querySelector('.cw-wrap') as HTMLElement
  const bar = wrap.querySelector('.cw-bar') as HTMLElement
  let through = false
  const setThrough = (on: boolean) => {
    if (on !== through) api.setClickThrough((through = on))
  }
  const within = (b: DOMRect, x: number, y: number, grow = 0) =>
    x >= b.left - grow && x <= b.right + grow && y >= b.top - grow && y <= b.bottom + grow
  window.addEventListener('mousemove', (e) => {
    if (wrap.classList.contains('dragging')) return setThrough(false)
    const onButton = within(wrap.getBoundingClientRect(), e.clientX, e.clientY)
    // the toolbar only counts while it's showing (plus the small gap leading to it)
    const onBar = getComputedStyle(bar).visibility === 'visible' && within(bar.getBoundingClientRect(), e.clientX, e.clientY, 8)
    setThrough(!(onButton || onBar))
  })
  document.addEventListener('mouseleave', () => setThrough(true))
  setThrough(true)
}

void main()
