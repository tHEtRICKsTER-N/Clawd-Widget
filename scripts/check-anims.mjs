// Checks that every animation still produces exactly the same frames.
//
//   npm run check:anims             compare against scripts/anims.snapshot.json
//   npm run check:anims -- --update rewrite the snapshot (only for a new animation or an intended change)
//
// Each animation is sampled at 60 fps through one play, two more loops and the fade-out
// after it ends. A sample covers what the renderer draws: the sprite, the particles, every
// grid cell's energy and glow, and the pressed-flash overlays. The idle pose is checked too.
// Samples are hashed in quarter-second chunks, so a change is reported with its time.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const SNAPSHOT = resolve('scripts/anims.snapshot.json')
const FPS = 60
const CHUNK = 15 // samples per hash (0.25 s)
const update = process.argv.includes('--update')

const vite = await createServer({
  configFile: false,
  root: resolve('.'),
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
})

let current
try {
  const load = (p) => vite.ssrLoadModule(p)
  const [{ ANIM_LIST, idlePose }, { playFrame, lingerFrame }, { computeField, createField, LEVELS }, { darkMix, introGlow }] = await Promise.all([
    load('/src/engine/animations/index.ts'),
    load('/src/engine/frame.ts'),
    load('/src/engine/grid.ts'),
    load('/src/engine/timeline.ts'),
  ])
  const field = createField()

  const poseKey = (p) =>
    [p.frame ? `${p.frame.dx},${p.frame.dy}:${p.frame.rows.join('/')}` : '-', p.scale, p.opacity, p.ox, p.oy].join('|')
  const particlesKey = (list) => list.map((q) => [q.x, q.y, q.glyph.join('/'), q.color, q.top ?? '', q.alpha].join(',')).join(';')
  const fieldKey = (t, pulses) => {
    if (!pulses.length) return ''
    computeField(t, pulses, field)
    const out = new Uint8Array(field.lit.length * 2)
    field.lit.forEach((v, i) => (out[i] = Math.round(v * LEVELS)))
    field.glow.forEach((v, i) => (out[field.lit.length + i] = Math.round(v * LEVELS)))
    return Buffer.from(out).toString('base64')
  }

  /** hash samples in chunks: [chunk hashes] */
  const fingerprint = (samples) => {
    const chunks = []
    for (let i = 0; i < samples.length; i += CHUNK) {
      const h = createHash('sha1')
      for (const s of samples.slice(i, i + CHUNK)) h.update(s + '\n')
      chunks.push(h.digest('hex').slice(0, 12))
    }
    return { samples: samples.length, chunks }
  }

  current = {}
  for (const a of ANIM_LIST) {
    const span = a.duration - a.loopFrom
    const samples = []
    // one play, then two more loops (loop mode) — covers the loop seam
    const n = Math.ceil((a.duration + 2 * span) * FPS)
    for (let i = 0; i < n; i++) {
      const t = i / FPS
      const f = playFrame(a, t)
      const flash = a.pressIntro ? `${darkMix(t)}|${introGlow(t)}` : ''
      samples.push([poseKey(f.pose), particlesKey(f.particles), fieldKey(f.fieldT, f.pulses), flash].join('#'))
    }
    // play-once: the pulses fade out after the end
    for (let i = 0; ; i++) {
      const f = lingerFrame(a, a.duration, i / FPS)
      if (!f) break
      samples.push('linger#' + fieldKey(f.fieldT, f.pulses))
    }
    current[a.id] = fingerprint(samples)
  }
  for (const blink of [true, false]) {
    const samples = []
    for (let i = 0; i < 3 * 3.7 * FPS; i++) samples.push(poseKey(idlePose(i / FPS, blink)))
    current[blink ? 'idle' : 'idle (no blink)'] = fingerprint(samples)
  }
} finally {
  await vite.close()
}

if (update) {
  writeFileSync(SNAPSHOT, JSON.stringify({ fps: FPS, chunk: CHUNK, anims: current }, null, 1) + '\n')
  console.log(`snapshot written: ${Object.keys(current).length} animations → ${SNAPSHOT}`)
  process.exit(0)
}

let saved
try {
  saved = JSON.parse(readFileSync(SNAPSHOT, 'utf8')).anims
} catch {
  console.error('No snapshot yet. Run `npm run check:anims -- --update` to create one.')
  process.exit(1)
}

let bad = 0
const pad = Math.max(...Object.keys({ ...saved, ...current }).map((k) => k.length)) + 2
for (const id of new Set([...Object.keys(saved), ...Object.keys(current)])) {
  const was = saved[id]
  const now = current[id]
  let verdict
  if (!was) verdict = 'NEW (not in the snapshot; run with --update once it looks right)'
  else if (!now) verdict = 'MISSING (in the snapshot but no longer exists)'
  else {
    const i = was.chunks.findIndex((h, k) => h !== now.chunks[k])
    if (i < 0 && was.samples === now.samples) verdict = 'same'
    else if (i < 0) verdict = `DIFFERENT: length changed (${(was.samples / FPS).toFixed(2)} s → ${(now.samples / FPS).toFixed(2)} s of samples)`
    else verdict = `DIFFERENT from ${((i * CHUNK) / FPS).toFixed(2)} s of samples`
  }
  if (verdict !== 'same') bad++
  console.log(id.padEnd(pad) + verdict)
}
if (bad) {
  console.error(`\n${bad} animation(s) changed. Existing animations must stay frame-identical.`)
  process.exit(1)
}
