// OBS overlay page: the button alone on a transparent page, set up from the URL (see core/overlay.ts).
import { parseOverlay } from './core/overlay'
import { ClawdButton, STATUSES, injectButtonCss, type Status } from './core/renderer'
import { ANIMATIONS } from './engine/animations'
import type { AnimId } from './engine/types'

const o = parseOverlay(new URLSearchParams(location.search))
document.documentElement.style.background = 'transparent'
document.body.style.cssText = `margin:0;background:transparent;padding:${o.pad}px;overflow:hidden`
injectButtonCss()
const b = new ClawdButton(document.body, o.settings)
b.el.addEventListener('click', (e) => b.click(e.clientX, e.clientY))
// for debugging from devtools and for tests
;(window as unknown as { clawdOverlay: ClawdButton }).clawdOverlay = b

if (o.state) b.setStatus(o.state)
else if (o.play) b.play(o.play)
if (o.every > 0) window.setInterval(() => b.play(o.play ?? o.settings.animation), o.every * 1000)

// live triggers: #play=<id> or #state=<status>
window.addEventListener('hashchange', () => {
  const h = new URLSearchParams(location.hash.slice(1))
  const p = h.get('play')
  const st = h.get('state')
  if (p === 'random' || (p && p in ANIMATIONS)) b.play(p as AnimId | 'random')
  else if (p) b.play()
  if (STATUSES.includes(st as Status)) b.setStatus(st as Status)
})
