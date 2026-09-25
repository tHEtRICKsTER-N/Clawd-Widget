# Improvement plan

Goal: make this the best widget out there for gamers, game devs and techies who love Clawd, **without changing the animations we already have**.

We build one item at a time. Progress notes go in [DEVLOG.md](DEVLOG.md).

## Ground rules

- **Existing animations stay frame-identical.** `npm run check:anims` must say `same` for every animation. Only run it with `--update` when a new animation is added or a change is intended.
- **The engine stays pure.** Animations remain functions of time. Live, stateful behaviour (cursor, drag, games) lives in the renderer or the hosts, not in `src/engine/animations/`.
- **Nothing annoying by default.** Sound is off until turned on, and every new behaviour gets a toggle.
- **All three hosts.** Web playground, extension and desktop, unless an item says otherwise.
- **Extension storage.** Nothing on a hot path writes to `chrome.storage.sync`, which allows only 120 writes a minute. Counters and stats go in `chrome.storage.local`.

## Definition of done (every item)

1. Built: `npx tsc -p tsconfig.json` and `npm run check:anims` pass, and `npm run build:ext` and `npm run build:desktop` succeed.
2. Checked in the playground, plus the host the item targets.
3. README updated if users can see the change.
4. DEVLOG entry written, and the box below ticked.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · size S / M / L

---

## Phase 1: Clawd feels alive

Right now Clawd only does something when clicked. This phase gives it a life between plays.

- [x] **1.1 Eyes follow the cursor** (S). Desktop was checked headless; a manual run on Windows is still worth doing (see DEVLOG).
  Clawd watches your pointer while idle, in 8 directions, and looks straight at you when the pointer is on its face. After a few seconds of stillness it goes back to its normal blinks and glances. On desktop the main process sends the global cursor position, so Clawd watches the mouse anywhere on screen. Setting: *Eyes follow cursor* (on by default).

- [x] **1.2 Dangles while dragged, thuds when dropped** (S)
  While being dragged: air legs, arms up, wide eyes, a small wobble. On drop: crouch, then a `land` pulse through the grid. Works in page mode and desktop mode.

- [x] **1.3 Poke and combo** (S/M)
  A click on Clawd's body gets a squish plus a heart instead of a full play. The rest of the button still plays the animation. Rapid pokes build a combo ("x5!") with bigger pulses on each hit and a small celebration at 10.

- [x] **1.4 Idle life** (M)
  Every few minutes, a rare micro-animation: stretch, yawn, scratch, or wander across the button and back. After a long idle it dozes off (Sleepy pose plus Zzz) and wakes up when the cursor comes near. Setting: *Idle antics*.

- [x] **1.5 Idle loop sleeps between changes** (S)
  The frame loop runs 60 times a second even at rest. Make it wait until the next scheduled change (blink, antic) or an input event (cursor, drag, click). Done last in this phase so it knows every wake source.

## Phase 2: Safety

- [x] **2.1 Reduced motion and flash cap** (S)
  Guitar Jam's strums flash near-white cells about 5 times a second, above the WCAG guideline of 3 a second. Under `prefers-reduced-motion`, cap pulse strength, skip the tap flash, and keep the cursor tracking calm. Nothing changes for other users.

## Phase 3: Claude Code integration

- [x] **3.1 Control the running widget from the command line** (S)
  `Clawd Widget.exe --play jump`, `--state working|waiting|done|idle`. The existing single-instance lock forwards argv to the running widget through `second-instance`. Optionally, a localhost-only endpoint for `curl`, protected by a token file.

- [ ] **3.2 Thinking animation plus hooks recipe** (S/M)
  A looping *Thinking 💭* animation for the working state. README recipe: `UserPromptSubmit` → working, `Notification` → wave with "!", `Stop` → Jump Party.

## Phase 4: For gamers

- [ ] **4.1 Chiptune sound effects** (M), off by default
  Square-wave and noise sounds synthesized with Web Audio, keyed to pulse types (`strum`, `power`, `land`, `twinkle`), so they stay in exact sync with the visuals. No audio files. Volume setting plus a mute button in the toolbar.

- [ ] **4.2 Themes gamers and devs recognize** (S)
  Game Boy DMG, PICO-8, Virtual Boy, Synthwave, Dracula, Catppuccin, Tokyo Night, Nord. Optional CRT scanline overlay. Share codes: copy the theme as a short string and paste one in.

- [ ] **4.3 Konami code and a secret animation** (S)
  ↑↑↓↓←→←→BA while the widget has focus. Never listens to keys on the host page.

- [ ] **4.4 Achievements and cosmetics** (M)
  Achievements like first play, 100 clicks, every animation played, or playing at 3 AM show a pixel toast. They unlock hats and "deal with it" shades, drawn as glyphs anchored to Clawd's head. This needs a head anchor per pose: `front()` already knows it, and the traced guitar frames need one each.

- [ ] **4.5 Bug Jump mini-game** (L)
  The 62×10 energy grid becomes the playfield. Clawd jumps over bugs, collects ✓s, jumps and landings fire pulses, and the label becomes the score display. High score saved. Opens from a 🎮 toolbar button (and the Konami code).

## Phase 5: For devs and creators

- [ ] **5.1 Export GIF, WebM and sprite sheet** (M)
  Any animation, in the current theme, at any size. `setControlled` already renders exact frames.
- [ ] **5.2 `<clawd-button>` web component on npm** (M)
  Game devs can drop it onto an itch.io page as their Play button.
- [ ] **5.3 OBS overlay URL** (S)
  Transparent background, with settings and triggers in the URL.
- [ ] **5.4 New animations** (S each)
  Ship It 🚀, Bug Squash 🐛, Level Up ⬆️, plus seasonal ones that switch on by date.

## Parking lot (not scheduled)

- Clawd climbs out of the button and walks along the taskbar (classic desktop pet)
- Dynamic label tokens: `{time}`, `{clicks}`, `{streak}`
- Twitch chat triggers for streamers
