# Devlog

What changed, why, how it was checked, and anything left open. Newest first. The roadmap is in [PLAN.md](PLAN.md).

---

## 2026-09-25 · 1.1 Eyes follow the cursor ✅

**What.** While Clawd rests, its pupils follow the pointer in 8 directions. When the pointer is on its face, it looks straight at you. Five seconds after the pointer stops moving, it goes back to its usual blinks and glances. Blinking continues while it watches, and the random glances pause. On desktop it follows the mouse anywhere on screen, not just over the widget. New setting **Eyes follow cursor**, on by default.

**How.**
- `src/engine/clawd.ts`: `front()` takes an optional `gaze: [x, y]` that shifts open eyes by one pixel per axis. New pure `gazeToward(dx, dy, face)` picks one of 8 directions in 45° sectors, or straight ahead within the face radius.
- `src/engine/animations/index.ts`: `idlePose(t, blink, gaze)`. With no gaze, the logic is unchanged.
- `src/core/renderer.ts`: `ClawdButton` listens for `pointermove` on its window itself, in the capture phase and passive, so pages that stop propagation can't hide the pointer. That covers the playground, the extension and the settings preview with no host code. `lookAt(x, y)` is public for hosts with a better source. The layout read (`getBoundingClientRect`) happens at most once per frame, and only after the pointer moved. It's also skipped whenever an animation is playing.
- Desktop: `main.cjs` checks `screen.getCursorScreenPoint()` 20 times a second, but only while the widget is visible and the setting is on. It sends window-relative coordinates over the `cursor` IPC channel, and only when the cursor has actually moved. The path is `preload.cjs` (`onCursor`) → `desktop/src/widget.ts` → `button.lookAt()`.
- `settings.ts`: `followCursor`, default `true`. Settings saved before this change get the default through `normalize()`.
- Settings panel: checkbox next to *Blink when idle*.

**Checked.**
- Scratch test of the real engine code, all 23 checks passed: every direction moves the pupils the right way; pupils stay inside the body; the face radius makes it look straight ahead; blinking continues while watching; with no cursor, idle matches a verbatim copy of the original `idlePose` frame for frame over 66 s, with blinking on and off.
- `npm run check:anims`: every animation and idle report `same`.
- `tsc`, `node --check` on `main.cjs`, `build:ext`, `build:desktop`: all passed.
- Playground: no console errors, both widgets mount, and the toggle shows up checked for settings saved before this change.

**Not checked yet.**
- **Watching it live in a browser.** The Browser pane was hidden, and hidden tabs pause animation frames. To try it, open the playground and move the mouse around the preview or the floating widget.
- **Desktop at runtime.** The Electron binary isn't downloaded (see Kickoff). The code builds and the syntax checks pass, but the cursor feed hasn't run.

**Notes and follow-ups.**
- Scrolling without moving the mouse doesn't update the gaze. The page widget is `position: fixed`, so this only affects the settings preview. It's fine for now.
- Item 1.5 (idle loop sleeps) has to wake the loop on `lookAt()`.
- Tuning knobs are in `renderer.ts`: `WATCH_MS` (5000), `FACE_R` (14 reference px), `EYES_REF`.

---

## 2026-09-25 · Tooling: animation regression check

**What.** `npm run check:anims` enforces the plan's first rule, that existing animations stay frame-identical. It fingerprints every animation's sprite, particles and quantized energy grid at 60 fps, one hash per second, plus the idle pose. It compares the result with `scripts/anim-snapshot.json`, reports which animation changed and in which second, and exits non-zero. It takes about 1.5 s.

**How.** `scripts/check-anims.ts` is bundled with esbuild (installed with Vite) and run with Node, because Node 22 can't resolve the codebase's extensionless imports. Use `-- --update` to accept a new or intentionally changed animation.

**Checked.** The snapshot matches the original animations. I confirmed it catches a change by corrupting one hash: it reported `CHANGED hello  first difference in 1–2 s` and exited 1.

---

## 2026-09-25 · Kickoff

- Reviewed the engine, renderer and all three hosts, and wrote [PLAN.md](PLAN.md): 5 phases, from "Clawd feels alive" to creator tools.
- Dev setup: dependencies were installed with `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to get the web playground running quickly. `npm run desktop` fails until the binary is fetched with `node node_modules/electron/install.js`, which downloads about 100 MB.
- Git: `main` holds the original project exactly as it was handed over. The work happens on the `improvements` branch, with one commit per plan item, so each one can be reviewed or reverted on its own.
