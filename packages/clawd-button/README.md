# clawd-button

Clawd, the pixel crab, as a drop-in `<clawd-button>` web component. It's an animated Play button: Clawd rocks out on a guitar (or ships a rocket, squashes a bug, levels up…) while an energy grid pulses behind the label. It has 12 animations and 15 themes, and chiptune sound if you turn it on. No dependencies and no framework: one `<script>` tag.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/clawd-button@0.1/dist/clawd-button.js"></script>

<clawd-button text="Play" theme="synthwave" anim="levelup" href="game.html"></clawd-button>
```

Click it (or focus it and press Enter or Space) and it plays. With `href`, the page goes there once the animation ends; a second click goes straight away.

It's part of [Clawd Widget](https://github.com/tHEtRICKsTER-N/Clawd-Widget), which also comes as a browser extension and a desktop widget.

## Install

From a CDN, as above. Use the full path to the file: the fonts load as separate chunks, relative to it.

From npm:

```bash
npm install clawd-button
```

```js
import 'clawd-button' // registers <clawd-button>
```

Or copy `dist/` next to your page (for example into an HTML5 game's zip) and load `dist/clawd-button.js` with `<script type="module">`. Module scripts need a web server, so they don't load from `file://`. itch.io and any static host are fine.

## Attributes

All are optional and can change at any time.

| attribute | default | what it does |
|---|---|---|
| `text` | `Play` | the label |
| `theme` | `original` | a preset (`original`, `midnight`, `sunset`, `matrix`, `ocean`, `candy`, `mono`, `dmg`, `pico8`, `vboy`, `synthwave`, `dracula`, `catppuccin`, `tokyonight`, `nord`) or a share code (`clawd:…`) copied from the [playground](https://github.com/tHEtRICKsTER-N/Clawd-Widget) |
| `anim` | `guitar` | `guitar`, `hello`, `jump`, `code`, `dance`, `sleep`, `think`, `ship`, `squash`, `levelup`, `spooky`, `snow`, or `random` (a different one each click; seasonal ones only in season) |
| `size` | `340` | width in px, from 160 to 900; the height follows (676 × 104 proportions) |
| `font` | `inter` | `inter`, `space`, `mono`, `silkscreen`, `press` (pixel fonts), `system`, `serif` |
| `bold` | on | `bold="off"` for the regular weight |
| `loop` | off | keep playing after a click |
| `href`, `target` | | go to this URL when the play ends (`target="_blank"` opens a new tab) |
| `state` | | `working` loops Thinking, `waiting` waves then shows "!", `done` plays Jump Party, `idle` rests |
| `sound` | off | chiptune sound effects in sync with the grid (they start after the first click) |
| `volume` | `50` | 0–100 |
| `crt` | off | scanlines and a vignette |
| `wear` | | `partyhat`, `propeller`, `crown`, `shades`, `nightcap`, `headphones` |
| `idle` | on | `idle="off"`: no stretching, yawning, wandering or dozing between plays |
| `eyes` | on | `eyes="off"`: Clawd doesn't follow the pointer |
| `blink` | on | `blink="off"`: no blinking or glancing around |
| `pokes` | off | `pokes`: a click on Clawd itself pokes it (squish, heart, combos) instead of playing |
| `flash` | on | `flash="off"`: no dark flash when a play starts |

A boolean attribute is on when present (`<clawd-button sound>`), and off with `="off"`, `="false"`, `="no"` or `="0"`.

## Events and methods

```js
const btn = document.querySelector('clawd-button')
btn.addEventListener('clawd-play', (e) => console.log('playing', e.detail.anim))
btn.addEventListener('clawd-end', (e) => startGame())

btn.play('ship')          // or play() for the `anim` attribute
btn.stop()
btn.setStatus('working')  // same as the state attribute
```

Both events bubble and cross shadow roots. TypeScript types are included.

## As an itch.io Play button

itch.io runs an HTML5 game's `index.html` in a frame; the project page itself doesn't allow scripts. So put the button on your game's start screen:

```html
<clawd-button text="Start game" anim="levelup" theme="pico8"></clawd-button>
<script type="module">
  import './clawd-button/clawd-button.js'
  document.querySelector('clawd-button').addEventListener('clawd-end', () => startGame(), { once: true })
</script>
```

## Good to know

- **Keyboard and screen readers:** it's a focusable `role="button"` named after its label. Enter and Space play it.
- **Reduced motion:** under `prefers-reduced-motion` the grid flashes are capped (at most 3 a second, softer), there's no tap flash and the eyes move calmly.
- **Size on the wire:** 36 kB gzipped, plus about 25 kB per font face the first time a font is shown (Inter uses two). Nothing else is fetched.
- **Secrets:** try ↑↑↓↓←→←→BA on a focused button.
- **Server-side rendering:** importing it without a DOM is safe; it registers the element in the browser.

## License

MIT. The embedded fonts keep their SIL Open Font License 1.1, whose notices are in `dist/FONTS-LICENSE.txt`. Clawd is the Claude Code mascot; this is an unofficial fan project, not affiliated with Anthropic.
