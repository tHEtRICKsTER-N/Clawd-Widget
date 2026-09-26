# Clawd Widget: notes for Claude Code

A pixel-art Clawd button that ships as a web playground, a browser extension, an Electron desktop widget, a `<clawd-button>` web component and an OBS overlay, all from one TypeScript codebase. Start with [README.md](README.md) (the code map is there), [PLAN.md](PLAN.md) (what's done and what's next) and the newest entries in [DEVLOG.md](DEVLOG.md).

## Ground rules

- **Existing animations stay frame-identical.** `npm run check:anims` must say `same` for everything that already exists. Run it with `--update` only to add a new animation, antic or reaction (it then reports `NEW` entries) or for a change the owner asked for.
- **The engine stays pure.** `src/engine/` is functions of time: no DOM, no state, no `Date.now()`. Live behaviour belongs in `src/core/` (renderer, life, game) or the hosts.
- **Nothing annoying by default.** Sound and new behaviours are off, or rare and subtle, until turned on, and every one gets a setting.
- **All hosts.** A setting or behaviour works in the playground, the extension, the desktop app, `<clawd-button>` and the overlay unless there's a reason it can't.
- **Extension storage.** Nothing on a hot path writes `chrome.storage.sync` (120 writes a minute). Counters and stats go to `chrome.storage.local`.
- **Kind to eyes.** At most 3 grid flashes a second. Under reduced motion `calmPulses` enforces it, but design for it anyway.

## Commands

```bash
npm install
npm run dev            # playground: http://localhost:5178 (?sheet=<animation> shows a frame sheet)
npm run desktop        # run the desktop widget
npx tsc -p tsconfig.json
npm run check:anims    # animation snapshot check
npm run build && npm run build:ext && npm run build:desktop && npm run build:wc
```

CI runs the type check, `check:anims` and all four builds on every push and PR.

## Workflow

- `main` is protected: work on a branch and open a pull request. Never force-push `main`.
- One item at a time. For each: build it, check it in the playground and the host it touches, update the README if users can see it, add a DEVLOG entry (what changed, how it was checked, what wasn't), and tick its box in PLAN.md.
- Releases: in a PR, bump with `npm version minor --no-git-tag-version` and add the version's section to `CHANGELOG.md` (the Release workflow requires it and uses it as the notes). After it merges, push the tag (`git tag vX.Y.Z` then `git push origin vX.Y.Z`), and the workflow builds and publishes the downloads. The web component in `packages/clawd-button` has its own version.
- Write code like the code around it: small modules, comments that explain why.
