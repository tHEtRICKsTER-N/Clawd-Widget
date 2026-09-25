# Devlog

Progress notes for [PLAN.md](PLAN.md), newest first.

---

## 2026-09-25 · 1.3 Poke and combo

A click on a resting Clawd's body or legs, with a sprite pixel of slack, is a poke instead of a play. Clawd squishes flat with its eyes shut and arms flinching up for 0.08 s, then bounces back with happy eyes until 0.26 s. A small heart floats up and away, 60% to the right. A ring pulse goes through the grid. Clicks anywhere else on the button still play, and so does any click while an animation is running. Setting: *Poke Clawd*, on by default.

**Combo.** Pokes less than 0.8 s apart build a combo. From the second hit a counter ("x5!") in a new 3×5 pixel font (`tinyText` in `particle.ts`) sits over Clawd's head and hops on each hit. It fades 0.8 s after the last poke. Each hit's ring is stronger: 0.3 at the first, up to 0.8. **Every 10th hit** Clawd celebrates: a crouch, a 6 px cheering hop with a ring on take-off, a full-strength `land` shockwave, two fountains of confetti, then arms up. The counter hides while Clawd is in the air, because the hop would jump into it. Pokes during a celebration keep counting.

**Refactor: `src/core/life.ts`.** Everything Clawd does between plays now lives in `ClawdLife`: gaze (1.1), drag and drop (1.2) and pokes. It is ticked by the renderer when nothing is playing and returns a pose, pulses and particles. All its timing is on its own clock, so reactions compose by priority (dangle > celebration > poke > drop > idle or watching) without step counters. The renderer is back to drawing and play logic, and gets `click(x, y)`, which picks poke or play. `FloatingWidget` (page and window mode) and the React `UltracodeButton` now call `click`; the toolbar, keyboard and menus still call `play`. 1.4's antics and 1.5's "when is the next change" will go here too.

**Renderer fix.** While resting, the frame loop skipped redraws when the pose name was unchanged and no pulses were fading. It now also redraws while particles are on screen; before this, hearts would have frozen.

**`check:anims` covers reactions.** Five entries were added: `reaction: dangle`, `drop`, `poke` (pose, hearts, rings at combo 1/5/10), `combo` (counter for 2, 5, 10, 12 and 99 through its fade) and `celebrate`. This was an intended addition: the snapshot only gained lines. The summary now reports new entries separately from changed ones.

**Settings UI.** A new *Between plays* card holds *Blink when idle*, *Eyes follow cursor*, *Dangle when dragged* and *Poke Clawd*. The Animation card keeps play mode and *Tap flash*. The preview hint says "or poke Clawd" when pokes are on.

Verified:
- Playground (Chromium, real clicks on a `FloatingWidget`): a poke goes `poke` → `poke-up` → watching, with combo 1 and no play. A label click plays. 5 quick pokes reach combo 5; a poke after a 1.2 s pause restarts at 1. 10 quick pokes run the whole celebration (`cheer-crouch`, hop to 6 px, `cheer-land`, `yay`). With pokes off, a body click plays. During a play, a body click restarts it. Screenshots: squish plus heart; "x5!" over the head; the hop with the counter hidden; the landing with "x10!", confetti and shockwave. Poking the settings preview works.
- Regressions: the 1.1 gaze test (9 directions, stillness, setting off, during play) and the 1.2 drag test pass unchanged after the move into `ClawdLife`. The renderer pixel check (2,285 frames of the six animations) is identical.
- Desktop (Electron under Xvfb): 4 clicks on Clawd show "x4!". A label click plays Guitar Jam.
- Settings: the new card wraps cleanly in the playground and in the 392 px extension popup.
- `tsc`, `check:anims` (13 × `same`), `build:ext` and `build:desktop` pass.

## 2026-09-25 · 1.2 Dangles while dragged, thuds when dropped

While the widget is being dragged, Clawd lifts 2 px off the ground with its arms raised (the same arms as Jump Party's airborne pose), wide eyes and legs hanging. It sways ±1 px at 1.6 Hz. On release it lands in a crouch with its eyes shut for 0.12 s, then straightens up with its arms raised until 0.34 s. A `land` pulse at strength 0.7, a bit softer than Jump Party's landings, runs through the grid. Setting: *Dangle when dragged*, on by default, in the Widget card.

It only reacts while resting. A drag during a play just moves the widget and the animation carries on. A click without a drag still plays.

How it's split:
- **Engine (pure).** `src/engine/reactions.ts` has `dangle(t)`, `drop(t)` (null once it's over) and `dropPulse(t0, seed)`. It's kept out of `animations/`, so the ground rule about the engine holds: timing and state live in the renderer, looks are functions of time.
- **Renderer.** `setDragging(on)` starts the dangle, and on release switches to the drop and fires a pulse. Reaction pulses live on the renderer's own clock and are shifted onto whatever clock the field uses that frame, so they combine with the fade-out of a play that just ended. `play()` clears any reaction.
- **Widget.** `FloatingWidget` calls `setDragging` when a pointer move passes the 5 px drag threshold and on release. Page mode and window mode share this path, so the desktop app gets it without changes to the main process.

Verified:
- Playground (Chromium, real mouse drag of a `FloatingWidget`): the pose sequence during the drag is `dangle 0/1/0/-1…`, and after release `thud` → `thud-up` → watching the pointer. Screenshots show raised arms and wide eyes mid-drag, and the crouch with the disc pulse just after the drop. With the setting off, a drag gives no reaction. A drag during Hello Wave doesn't interrupt it. A click still plays.
- Desktop (Electron under Xvfb, Playwright mouse on the widget window): the main process traces `drag start` and `drag end`, and screenshots show the dangle during the drag and the thud with its pulse after release.
- `tsc`, `check:anims` (all `same`), `build:ext` and `build:desktop` pass.

## 2026-09-25 · 1.1 Eyes follow the cursor

While idle, Clawd watches the pointer in 8 directions and looks straight ahead when the pointer is on its body. After 3 s without a pointer move it goes back to the normal blink-and-glance cycle. It still blinks while watching. It never changes a playing animation. Setting: *Eyes follow cursor*, on by default.

How it's split:
- **Engine (pure).** `front()` takes `gaze: [x, y]`, which moves the open eyes one sprite pixel that way. `idlePose(t, blink, gaze)` returns the watching pose, keeping the blink from the idle cycle and dropping the glances. With no gaze, the idle pose is unchanged (`check:anims`: `idle` is `same`). `BODY` in `clawd.ts` is the body box of the standing pose; 1.3 (poke) will use it for hit testing too.
- **Renderer.** `ClawdButton` listens to `pointermove` on its window (capture, passive, so a page can't swallow it) and exposes `lookAt(x, y)` for hosts that know more. Each idle frame within 3 s of the last move, it maps the body box to client px. Inside the box it looks straight ahead; otherwise it rounds the angle from eye level to the nearest 45°.
- **Desktop.** The widget page only sees the mouse over its own window, so the main process polls `screen.getCursorScreenPoint()` every 50 ms and sends changes as `cursor` in window coordinates (`preload.onCursor` → `button.lookAt`). Polling runs only while the widget is visible and the setting is on.

Verified:
- Playground (Chromium): real mouse moves in all 8 directions plus on the face give the expected pose. Clawd is back to `idle` 3.2 s after the last move, doesn't watch with the setting off, and a playing Hello Wave is untouched. Screenshots show the eyes shifting. The checkbox saves.
- Extension: the built `content.js` in `dev/ext-harness.html`, with the page swallowing `pointermove` at the document in capture phase. Clawd still follows the pointer, because the window-level capture listener runs first.
- Desktop (Electron 44 under Xvfb, driven by Playwright): with the global cursor stubbed in the main process, far-left, far-up and far-down-left positions redraw Clawd differently. With the setting off no `cursor` messages are sent; turning it back on resumes them.
- Not yet done: a manual run on Windows with a real mouse, especially on mixed-DPI multi-monitor setups, where screen DIPs across monitors are the thing to watch.
- `tsc`, `check:anims` (all `same`), `build:ext` and `build:desktop` pass.

## 2026-09-25 · Groundwork: `check:anims`

This repository starts from the 1.0.2 import, which predates the plan. PLAN.md marks 1.1 (eyes follow the cursor) as done and 1.2 (drag and drop) as in progress, but that work isn't in this repository, and neither is the `check:anims` script the ground rules rely on. All three are rebuilt here.

**`npm run check:anims`** (`scripts/check-anims.mjs`) loads the engine through Vite's SSR loader, so it needs no extra dependencies. It samples every animation at 60 fps: one play, two more loops (to cover the loop seam), and the fade-out after a play-once ends. For each sample it records the sprite (frame, offset, scale, opacity), the particles, the quantized energy and glow of all 620 cells, and, for Guitar Jam, the pressed-flash overlays. The idle pose is checked too, with and without blinking. Samples are hashed in quarter-second chunks, so a change is reported as "DIFFERENT from 1.50 s". Changing one pulse's strength by 0.01 is caught.

To make the check cover what is actually drawn, the renderer's frame composition moved into a pure engine module, **`src/engine/frame.ts`**. `playFrame(anim, t)` handles the loop section and pulses carried across the loop seam, and `lingerFrame(anim, end, after)` handles pulses fading out after a play. The renderer now calls these instead of its own copy.

Verified:
- `check:anims` snapshot taken from the unchanged engine; `same` for all 8 entries after the move.
- Renderer-level check in Chromium: every animation rendered in controlled mode at 30 fps through a play and two loops (2,285 frames), hashing all three canvases and the flash overlays, before and after the refactor. All frames were identical.
- `tsc`, `build:ext` and `build:desktop` pass.
