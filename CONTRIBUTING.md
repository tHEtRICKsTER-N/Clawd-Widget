# Contributing

Thanks for wanting to make Clawd better! New animations, themes, things for Clawd to wear, bug fixes and host improvements are all welcome. For anything big, open an issue first so we can talk it through.

## Setup

You need Node.js 20 or newer.

```bash
npm install
npm run dev          # the playground at http://localhost:5178
```

The playground has everything: the button, the settings, a floating widget, the exporter and the OBS overlay builder. `?sheet=<animation>` shows a contact sheet of one animation, frame by frame.

## Ground rules

These keep Clawd feeling the same for everyone while it grows.

- **Existing animations stay frame-identical.** `npm run check:anims` compares every animation, reaction and antic, frame by frame, with `scripts/anims.snapshot.json`. It must say `same` for everything that was already there. Run it with `--update` only to add a new animation (it then reports `NEW` entries) or when a change is intended, and say so in the PR.
- **The engine stays pure.** Everything in `src/engine/` is a function of time with no DOM and no state. Live behaviour (the cursor, dragging, the game) lives in `src/core/`.
- **Nothing annoying by default.** Sound is off until turned on, and every new behaviour gets a setting to turn it off.
- **All the hosts.** The playground, the extension, the desktop widget and `<clawd-button>` share the same code. Check that a change works in the ones it touches.
- **Kind to eyes.** Keep grid flashes to 3 a second or fewer. Under reduced motion, `calmPulses` enforces that, but design for it anyway.

## Adding an animation

1. Create `src/engine/animations/<name>.ts` exporting an `AnimationDef`. `ship.ts`, `squash.ts` and `levelup.ts` are small, commented examples. Build poses with `front({...})`, schedule grid pulses with `scheduled(t, [[time, 'land'], ...])` and draw particles with the glyphs in `particle.ts`. `cellAt(x, y)` puts a pulse under a point of the sprite.
2. Register it in `src/engine/animations/index.ts`: in `ANIM_LIST`, or in `SEASONAL` with a `season`. Add its id to `AnimId` in `src/engine/types.ts` and to the menu list in `desktop/main.cjs`.
3. Look at it with `?sheet=<name>` and in the playground, with and without reduced motion.
4. Run `npm run check:anims -- --update`. It should only add `NEW` entries.

## Adding a theme or something to wear

- **Themes** are `PRESETS` in `src/core/settings.ts`: seven colours and a group.
- **Wearables** are in `src/engine/cosmetics.ts`: a small pixel glyph anchored to the head or the eyes, unlocked by an achievement in `src/core/achievements.ts`.

## Before you open a PR

```bash
npx tsc -p tsconfig.json
npm run check:anims
npm run build && npm run build:ext && npm run build:desktop && npm run build:wc
```

CI runs the same checks on every push and pull request. Write code that reads like the code around it. For a notable change, add a short entry at the top of [DEVLOG.md](DEVLOG.md): what changed, how you checked it, and anything you couldn't check.
