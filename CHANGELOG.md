# Changelog

What's new in each release. The detailed notes on how each change was built and tested are in [DEVLOG.md](DEVLOG.md). The `<clawd-button>` package has its own version, given in brackets.

## [1.2.0] - 2026-09-26

Clawd keeps itself busy when you leave it alone.

### Added
- **Auto-play** (off by default): while Clawd rests, it plays a random animation now and then (roughly every 30 s, 1, 2, 5, 10 or 30 minutes, varied so it never feels mechanical) or **Non-stop**. It waits while you drag the widget, play Bug Jump, or Clawd is waiting on you, and pauses while the page or widget is hidden. Auto-plays don't count for achievements. Find it in *Between plays* and the desktop right-click menu.
- **Shuffle colors** (with auto-play): every auto-play glides smoothly into a random theme. Your own colours stay saved, and turning it off glides back to them. Auto-play on Non-stop plus Shuffle colors is a party mode.
- **Four new idle antics:** a sneeze, a whistle with floating notes, a look around, and a happy little hop.
- OBS overlay: `autoplay=60|nonstop` and `shuffle=1`.
- `<clawd-button>` (0.2.0): `autoplay` and `shuffle` attributes.
- `CLAUDE.md` and [docs/claude-code-locally.md](docs/claude-code-locally.md): working on this repo with Claude Code on your own PC.

### Fixed
- After Bug Jump was started by the secret code, the widget drew every frame twice from then on, using twice the CPU.

## [1.1.0] - 2026-09-26

The first release with downloads. Everything in phases 1–5 of [PLAN.md](PLAN.md).

### Added
- **Alive between plays:** eyes that follow your cursor (anywhere on screen, on desktop), dangling while dragged with a thud on landing, pokes with hearts and combos, idle antics (stretch, yawn, scratch, wander) and dozing off.
- **Claude Code integration:** `--play` / `--state working|waiting|done|idle` on the command line, an opt-in local endpoint, a looping *Thinking* animation, and a hooks recipe.
- **For gamers:** chiptune sound effects (off by default), 8 new themes (Game Boy, PICO-8, Virtual Boy, Synthwave, Dracula, Catppuccin, Tokyo Night, Nord), a CRT filter, theme share codes, a secret cheat code, 9 achievements with 6 things to wear, and the *Bug Jump* mini-game.
- **For creators:** export to GIF, WebM or a sprite sheet, and an OBS overlay set up from its URL.
- **New animations:** Ship It, Bug Squash, Level Up, plus seasonal Spooky (October) and Snow Day (December to early January).
- `<clawd-button>` web component (0.1.0).
- Reduced motion: at most 3 grid flashes a second, no tap flash, calmer eyes.

[1.2.0]: https://github.com/tHEtRICKsTER-N/Clawd-Widget/releases/tag/v1.2.0
[1.1.0]: https://github.com/tHEtRICKsTER-N/Clawd-Widget/releases/tag/v1.1.0
