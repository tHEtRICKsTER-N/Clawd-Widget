# Devlog

Progress notes for [PLAN.md](PLAN.md), newest first.

---

## 2026-09-25 · 4.1 Chiptune sound effects

Off by default. Turn it on in the new *Sound* card (with a volume slider), from a speaker button in the hover toolbar, or from *Sound effects* in the desktop right-click menu.

**Synth** (`src/core/sound.ts`, `ChipSound`): Web Audio oscillators and one shared buffer of seeded white noise, with no audio files. Each pulse kind has a sound, scaled by the pulse's strength:
- `strum`: a square pluck, pitch from a pentatonic run picked by the pulse's seed, so a riff sounds the same every loop.
- `sway`: a softer triangle note.
- `power`: a square root plus fifth with a hiss.
- `first`: a power chord plus an upward sweep.
- `land`: a square thump sliding from 160 to 55 Hz, plus low noise.
- `twinkle`: a tiny high blip.
- `scan`: a quick upward sweep.
- `soft`: silent. It's the slow breathing glow, and Thinking and dozing loop it for minutes.

No AudioContext is made until the first sound with sound on.

**Sync.** The renderer sounds each pulse as it starts, on the same frame it appears. At first I used "age under one frame step", but pulses carry a few ms of seeded jitter on their start while entering the list on their un-jittered time. So some were first seen already 19 ms old (skipped), and some before they had started. Measured on looping Hello Wave, 2 of its 5 pulses per loop never sounded. The renderer now remembers each sounded pulse (kind, seed and start time on its own steady clock, kept 3 s) and sounds it once, when its age turns ≥ 0. A pulse first seen more than 0.25 s after starting stays quiet, so switching sound on mid-play doesn't produce a burst. Under reduced motion, sounds follow the thinned pulses. No sounds in controlled mode (reference compare, contact sheets).

**Autoplay.** Browsers start audio only after a gesture. Click paths call `unlockSound()`: clicking the button, the toolbar, the keyboard, and the settings' play and animation buttons, and the *Sound effects* checkbox itself. The desktop widget window sets `autoplayPolicy: 'no-user-gesture-required'`, so sounds also play when a script or Claude Code hook starts an animation. `FloatingWidget` gained `onPatch`, which hosts (playground, extension, desktop) use to save a change made from the toolbar.

Verified:
- Offline render (`OfflineAudioContext`, 1 s per kind): every kind but `soft` is audible (RMS 0.008–0.056 in the first 50 ms), lasts 26–176 ms, and is silent after 400 ms. `soft` is silent.
- Chromium, playground widget, real click: sound off makes no `ChipSound` and plays nothing. With sound on, the AudioContext is `running` and Guitar Jam sounds all 14 pulses of a play once, no duplicates, each within one frame of its pulse. Looping Hello sounds 5 / 5 / 5 per loop. Under reduced motion Guitar Jam sounds 6. The toolbar speaker toggles the setting and `aria-pressed`, and saves through `onPatch`.
- Desktop (Electron under Xvfb): with sound on, `--play jump` from a second process with no click plays its sounds with the context `running`.
- Settings: the *Sound* card fits in the playground and the popup. Hint paragraphs lost their default margins.
- Regressions: the renderer pixel check is identical, and the nap, poke, gaze and drag suites pass. `tsc`, `check:anims` (28 × `same`), `build:ext` and `build:desktop` pass.

Not verified: listening. The container has no speakers, so the timbres have only been measured, not heard.

## 2026-09-25 · 3.2 Thinking animation plus hooks recipe

**Thinking 💭** (`animations/think.ts`): Clawd raises a hand, and its eyes turn up toward a thought bubble that grows from its head: a dot, a bigger dot, then the cloud. Inside the bubble the dots cycle (·, ··, ···, empty) every 0.4 s. It glances straight up and blinks once per loop, and the grid breathes with a soft glow every 1.6 s at strength 0.24, so it stays calm when it loops for minutes (1 pulse a second at most). A 1 s intro grows the bubble; after that it loops a 3.2 s section. It is a regular animation, so it's in the picker, the Random pool and the desktop menus. `--state working` now loops it instead of Code Mode.

**Found and fixed: intro pulses replayed on every loop.** Thinking is the first non-native animation whose loop doesn't start at 0. When it wrapped from 4.2 s back to 1.0 s, `anim.pulses(1.0)` still listed the intro's glow from 0.2 s, which is within the 2.2 s look-back. So that glow popped back in, half-faded, on every loop. The pulse-identity test from 2.1 caught it. `playFrame` now drops pulses from before the loop section once a play is looping. All other animations loop from 0 or loop natively, so they can't change: all six are `same`, and only `think` and `calm: think` differ, from the 4.2 s seam. After the fix there are 0 pop-ins in any animation.

**Hooks recipe** (README, *Recipe: Clawd follows Claude Code*). The format was checked against the current hooks docs:
- `UserPromptSubmit` → `--state working`.
- `Notification` with matcher `permission_prompt|idle_prompt`, so only when Claude really needs you, → `--state waiting`.
- `Stop` → `--state done`.

Each hook has `"async": true` so Claude never waits on the widget. The `curl` form works as an alternative when the endpoint is on.

Verified:
- Contact sheet and large frames: bubble, cycling dots, raised hand, glance and blink, and a gentle glow.
- Desktop (Electron under Xvfb): `--state working` from a second instance is still looping `think` 9 s later. `--play think` works.
- The picker shows Thinking; the grid is now 4 × 2 with Random.
- `check:anims` has 28 entries (`think` and `calm: think` new); the six originals are unchanged. `tsc`, `build:ext` and `build:desktop` pass.

Not verified: the recipe running under a real Claude Code session on Windows.

**Phase 3 is done.**

## 2026-09-25 · 3.1 Control the running widget from the command line

`Clawd Widget.exe --play <animation>` and `--state working|waiting|done|idle`, also written `--play=jump`. Values are checked; an unknown one prints the valid list and does nothing.

**Forwarding.** The desktop app already held a single-instance lock. A second start now passes its parsed command to the running widget as `requestSingleInstanceLock({ cli })` additional data, rather than letting the running widget re-parse the forwarded `argv`, which Chromium may reorder or add switches to. The second process exits at once. With no command it still just brings the widget back, as before. A command given when the app itself is starting runs once the widget page has loaded. `--play` shows a hidden widget; `--state` doesn't, because a hook firing on every prompt shouldn't undo "Hide".

**States** (`ClawdButton.setStatus`, in core so any host can use it; only the desktop app has a way to receive them today):
- `working` loops Code Mode until the next state (3.2 swaps in a Thinking animation). `play(id, { loop })` gained a per-play loop override for this, so it loops even with *Play once* set.
- `waiting` plays Hello Wave once, then rests with a bobbing "!" over its head (`waitingBadge`, still under reduced motion). Antics and dozing are suspended while waiting, and any click, poke or drag clears it.
- `done` plays Jump Party once; `idle` stops.

**Local endpoint (the plan's optional part).** A menu checkbox, off by default: *Control from scripts → Local endpoint on 127.0.0.1:47823* (`CLAWD_PORT` overrides the port). `POST /play/<animation>` and `POST /state/<state>` return 204. What guards it:
- It listens on 127.0.0.1 only.
- The `Host` header must be `127.0.0.1:<port>` or `localhost:<port>` (against DNS rebinding).
- It needs `Authorization: Bearer <token>`, compared in constant time. The token is 48 hex characters from `crypto.randomBytes`, in `control-token` in the app's data folder, created on first use with mode 600.
- Only POST is accepted, and there is no CORS, so a web page can't call it: a browser's pre-flight gets a 401 with no CORS headers.

*Show token file* reveals it in the file manager.

Verified (Electron 44 under Xvfb; real second processes started with the same `CLAWD_USER_DATA`, so they hit the same lock):
- Launched with `--state working`: plays Code Mode. Second instance `--play jump`: exits 0, and the widget plays Jump Party. `--state=waiting`: after the wave, resting with `waiting` on, and the screenshot shows the "!". `--state done` → Jump Party. `--state idle` → resting. `--play nope` → "unknown animation" and nothing changes.
- With the widget hidden: `--state working` leaves it hidden, `--play hello` shows it.
- Endpoint: no token 401, wrong token 401, foreign Host 403, GET 405, unknown path 404, unknown state 400. Correct requests return 204 and take effect, via `127.0.0.1` and `localhost`. The token file has mode 600. Connecting on the machine's network address (192.0.2.2) is refused.
- Browser (playground `FloatingWidget`): `working` still loops at 5 s with *Play once* set. `waiting` shows the badge after the wave. A label click while waiting plays and clears it; a poke clears it too. `done` ends resting.
- `check:anims`: a `reaction: waiting badge` entry was added (snapshot only gained lines; 26 × `same`). `tsc`, `build:ext` and `build:desktop` pass.
- The desktop widget page now exposes `window.clawdWidget` for devtools and tests.

Not verified: the packaged Windows `.exe`, where Chromium's handling of `argv` is what `additionalData` guards against.

## 2026-09-25 · 2.1 Reduced motion and flash cap

When the system asks for reduced motion (`prefers-reduced-motion: reduce`; on Windows that's *Animation effects* off, and Electron follows it), the button tones itself down. Nothing changes for anyone else: the renderer pixel check is identical and every `check:anims` entry is `same`.

- **At most 3 flashes a second.** The plan asked to cap pulse strength, but a cap alone doesn't change the rate the plan was worried about. So `calmPulses()` (engine, pure) also drops any pulse that starts less than 0.34 s after another one: WCAG 2.3.1 allows at most 3 flashes in any second, and 0.34 s is just over 1/3 s. A burst of rapid strums becomes its first strum. Measured over a play, two loops and the fade-out, the most pulses starting in any 1 s window is: Guitar Jam 6 → 2, Hello 3 → 2, Jump 3, Code 3, Dance 3, Sleepy 2.
- **Dimmer.** Every pulse's strength is capped at 0.4 (normally up to 1.02), which also dims the coloured under-glow.
- **No tap flash.** Guitar Jam's dark "pressed" flash and over-bright intro glow are skipped, whatever *Tap flash* says.
- **Calm eyes.** The gaze holds a direction for at least 0.6 s before following the pointer somewhere else. Napping (1.5) wakes up in time to apply a held change.
- **Settings.** The Animation card says the button is toned down while the system asks for reduced motion. It follows the setting live, and so does the button.

**Design note: why "any pulse within 0.34 s before".** The first version kept a pulse if it came 0.34 s after the last *kept* one. That chains: when the oldest pulse left the list, every later decision flipped, and a nearly dead Guitar Jam strum popped back in once per loop (found by a test that tracks each pulse's identity frame by frame). The final rule looks only 0.34 s back, and anything that recent is always still listed, so no pulse ever appears mid-life: 0 pop-ins across all six animations, looping and play-once. To keep that true for reaction pulses (pokes, drops), `ClawdLife` now keeps them listed for 2.2 s, as the animations do, and only counts them as "moving" while they are still fading. Twinkles light single cells, too small to be flashes, so they are neither dropped nor counted.

`check:anims`: six new `calm: <animation>` entries fingerprint each animation's grid under reduced motion (sprite and particles don't change). The snapshot only gained lines.

Verified:
- Chromium with reduced motion emulated: at 0.05 s into Guitar Jam the dark overlay's opacity is 1 normally and 0 when reduced. Just after the second B strum, the grid's total brightness goes from 5.17 M to 2.03 M, and the screenshot shows the fresh strum's white disc gone and the earlier ring dimmed. Switching back live gives the identical normal grid. Sweeping the pointer around Clawd for 2 s gives 40 eye-direction changes normally (fastest 46 ms apart) and 5 when reduced (at least 616 ms apart). The settings note shows.
- Normal users: renderer pixel check identical (2,285 frames). The gaze, drag, poke, antics and nap suites all pass unchanged. Desktop cursor test passes.
- `tsc`, `check:anims` (25 × `same`), `build:ext` and `build:desktop` pass.

## 2026-09-25 · 1.5 Idle loop sleeps between changes

While Clawd rests with nothing moving, the frame loop no longer runs 60 times a second. It naps on a timer until the next scheduled change, and input wakes it at once. Measured in Chromium: **9 frames in 8 s at rest** (before: about 480), 4 frames in the 4 s after the pointer stops, 2 frames in 3 s after a play has faded out. Dozing runs at about 10–12 fps.

How it knows when the next change is due:
- **Engine.** `idleNextChange(t, blink, watching)` next to `idlePose`: seconds until the blink or glance marks of the 3.7 s idle cycle, just past each mark. The cycle's timings became named constants shared by both functions (`check:anims`: `idle` is `same`).
- **`ClawdLife.frame()`** returns `rest`. It is 0 while anything moves: a reaction, hearts, pulses, the combo counter, a celebration, an antic or a wake-up. While dozing it is 1/12 s. At rest it is the soonest of: the idle cycle's next mark, when watching the pointer ends, the next antic, and dozing off.
- **Renderer.** `tick` = `step` (advance and draw, returns `rest`) + `schedule` (a `requestAnimationFrame`, or a `setTimeout` nap capped at 5 s as a safety net). Every input and state change calls `wake()`: pointer moves (only if eyes-follow or antics are on), clicks, drags, play, stop, settings, speed, controlled mode. During a nap, `wake()` first advances the clocks to now (`idleT`, and the new `life.advance(dt)`), so whatever the input starts is timed from now. The frame after a nap may use the whole nap as its `dt`, so the idle cycle and antic timers stay in real time. Naps only happen at speed 1, and not while a play or its fade-out is running.

Found and fixed along the way:
- **Input during a nap was timed from the last frame.** Without the catch-up, a poke arriving 1.5 s into a nap was stamped 1.5 s in the past, and the next frame thought it was already over. The test caught it; the catch-up in `wake()` fixes it.
- **The idle glance never looked right (already present in 1.0.2).** The redraw skip compared pose *names*, and both halves of the glance are called `glance`, so the look-right half never reached the screen. The skip now compares what is drawn: frame, offsets, scale and opacity. Frames from `front()` are cached, so identical poses are the same object. The idle pose itself is unchanged; the screen now shows all four still frames (idle, blink, left, right).

Verified:
- Chromium, playground widget: frame counts as above. Blinks still land 3.7 s apart in real time. The pointer moving wakes it and the gaze follows within a frame. A poke, drag, play and settings change from a nap all show within 30–40 ms. A bot colour change repaints while napping.
- Regression suites against the napping loop: gaze (9 directions, stillness, setting off, during play), drag (dangle, thud, setting off, during play), poke (single, label, combo, lapse, 10-hit celebration, setting off, during play), antics (every antic, poking a wandering Clawd, doze, wake, postponing, setting off, play). The antics test now wakes the loop after forcing timers on the live object.
- Natural timing at 60× speed: wander at 189 s, yawn at 291 s, nodding off at 301 s.
- Extension harness (hostile page) and desktop (Electron under Xvfb: cursor IPC, dangle while dragged and thud on drop in window mode) pass.
- Renderer pixel check identical (2,285 frames). `tsc`, `check:anims` (19 × `same`), `build:ext` and `build:desktop` pass.

**Phase 1 is done.**

## 2026-09-25 · 1.4 Idle life

**Antics.** Every 90–240 s (random) a resting Clawd does one of four things, never the same one twice in a row:
- **stretch** (1.6 s): arms up, eyes shut, two pixels taller (`squash: -2`), with a soft glow.
- **yawn** (1.9 s): eyes shut, mouth wide open, a breath in.
- **scratch** (1.7 s): one arm scratching its head, eyes squeezed happily shut.
- **wander** (6.3 s): looks left, walks 56 sprite px (about a quarter of the button) at 24 px/s with alternating legs, looks around, and walks back. A faint cell lights up under its feet every other step.

Antics wait while someone is playing with Clawd: they're postponed while the pointer has been near within the last 8 s. They are not postponed just because the mouse is moving elsewhere, so on desktop they still happen while you work.

**Dozing.** After 5 minutes with no pointer near Clawd (within 24 sprite px of it) and no click, drag or play, it nods off with a yawn. Then it sleeps: breathing every 0.9 s, a Z rising every 1.8 s, and a soft glow every 3.6 s. Pointer movement elsewhere doesn't wake it. When the pointer comes near, it wakes with a startled jump and a "!", then blinks awake. A poke, drag or play also ends a doze, an antic or a wake-up. Setting: *Idle antics*, on by default. Turning it off ends whatever is showing and stops the doze timer.

How it's split:
- **Engine.** `src/engine/antics.ts` defines an `Act` (duration, `pose(t)`, `pulses(t)`, `particles(t)`), a mini animation: the four antics, `doze` (endless) and `wake`. `front()` gained walking legs (`stepA`/`stepB`: one pair a pixel shorter) and `mouth: 'open'`. Existing options render the same (`check:anims`: all animations `same`).
- **`ClawdLife`.** A single `act` slot (antic, doze or wake), started and ended in `updateAct()`. Reactions win over acts, and acts win over the idle or watching pose. "Near" is checked once per frame, and only when the pointer has moved. The same lazily read button rect is used for the gaze, so there's at most one `getBoundingClientRect` per frame. Hit testing follows the pose's `ox`, so you can poke a wandering Clawd where it is (it pops back home for the poke).
- **`check:anims`.** Six new entries (`antic: stretch/yawn/scratch/wander/doze/wake`, doze sampled for 12 s). The snapshot only gained lines.

Verified (Chromium, playground widget; for most cases the timers were forced by setting `nextAntic` or `nearAt` on the live object, then run in real time):
- A due antic starts on its own (scratch) and the next is scheduled about 99 s later. Each antic runs its whole pose sequence and returns to idle. Screenshots: taller stretch, open-mouthed yawn, walking with the footprint cells, Zzz while dozing, the startle with "!".
- A click on Clawd at the far end of the wander pokes it. A pointer moving far away doesn't wake it; moving near gives `startle` → `awake` → watching. An antic that is due while the pointer is near is postponed. With the setting off, nothing starts. A play clears an antic.
- Regressions: the gaze, drag and poke suites give the same results as before. The renderer pixel check is identical (2,285 frames). The desktop cursor test passes.
- The *Between plays* card with *Idle antics* wraps cleanly in the playground and the popup.
- `tsc`, `check:anims` (19 × `same`), `build:ext` and `build:desktop` pass.

- Natural timing, with nothing forced: the renderer at 60× speed (`setSpeed(60)`) with the pointer parked far away. A scratch fired at 207 s of simulated idle, and Clawd nodded off at 301 s.

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
