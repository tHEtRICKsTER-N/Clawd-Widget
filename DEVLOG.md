# Devlog

What changed, why, how it was checked, and anything left open. Newest first. The roadmap is in [PLAN.md](PLAN.md).

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
