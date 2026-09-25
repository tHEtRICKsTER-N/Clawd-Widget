// Guard for PLAN.md rule 1: existing animations stay frame-identical.
// Fingerprints what every animation draws (sprite, particles, energy grid) at 60 fps, plus the
// idle pose, and compares it with scripts/anim-snapshot.json, one hash per second of animation.
// usage: npm run check:anims               compare against the snapshot
//        npm run check:anims -- --update   accept the current output (new or intentionally changed animations)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { ANIM_LIST, idlePose } from '../src/engine/animations'
import { COLS, ROWS, computeField, createField } from '../src/engine/grid'
import type { Particle } from '../src/engine/particle'
import type { Pose } from '../src/engine/types'

const FILE = 'scripts/anim-snapshot.json'
const FPS = 60
/** sample past the end: linger fades, loop seams, and Guitar Jam's later cycles */
const EXTRA = 8

const fnv = (h: number, s: string) => {
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const r6 = (v: number) => Math.round(v * 1e6) / 1e6

const poseKey = (p: Pose) =>
  p.frame ? `${p.frame.dx},${p.frame.dy},${r6(p.scale)},${r6(p.opacity)},${p.ox},${p.oy}|${p.frame.rows.join('/')}` : '-'
const fxKey = (list: Particle[]) => list.map((p) => `${p.x},${p.y},${p.color},${p.top ?? ''},${r6(p.alpha)},${p.glyph.join('/')}`).join(';')

const field = createField()
const out: Record<string, string[]> = {}

for (const a of ANIM_LIST) {
  const windows: string[] = []
  const n = Math.ceil((a.duration + EXTRA) * FPS)
  let h = 2166136261
  for (let i = 0; i < n; i++) {
    const t = i / FPS
    computeField(t, a.pulses(t), field)
    let cells = ''
    for (let c = 0; c < COLS * ROWS; c++) cells += String.fromCharCode(65 + Math.round(field.lit[c] * 20), 65 + Math.round(field.glow[c] * 20))
    h = fnv(h, `${poseKey(a.pose(t))}#${fxKey(a.particles(t))}#${cells}`)
    if ((i + 1) % FPS === 0 || i === n - 1) {
      windows.push(h.toString(16).padStart(8, '0'))
      h = 2166136261
    }
  }
  out[a.id] = windows
}

// resting pose with no cursor around (blink on and off)
out.idle = []
for (let s = 0; s < 12; s++) {
  let h = 2166136261
  for (let i = 0; i < FPS; i++) h = fnv(h, poseKey(idlePose(s + i / FPS, true)) + poseKey(idlePose(s + i / FPS, false)))
  out.idle.push(h.toString(16).padStart(8, '0'))
}

if (process.argv.includes('--update') || !existsSync(FILE)) {
  writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n')
  console.log(`snapshot written → ${FILE} (${Object.keys(out).join(', ')})`)
  process.exit(0)
}

const snap: Record<string, string[]> = JSON.parse(readFileSync(FILE, 'utf8'))
let failed = false
for (const id of new Set([...Object.keys(snap), ...Object.keys(out)])) {
  const was = snap[id]
  const now = out[id]
  if (!was) console.log(`new    ${id}  (not in the snapshot yet; run with --update to add it)`)
  else if (!now) {
    console.log(`GONE   ${id}  is in the snapshot but no longer exists`)
    failed = true
  } else {
    const i = was.findIndex((h, k) => h !== now[k])
    if (i < 0 && was.length === now.length) console.log(`same   ${id}`)
    else {
      const at = i < 0 ? Math.min(was.length, now.length) : i
      console.log(`CHANGED ${id}  first difference in ${at}–${at + 1} s`)
      failed = true
    }
  }
}
if (failed) console.log('\nAn existing animation changed. If that was intended, run: npm run check:anims -- --update')
process.exit(failed ? 1 : 0)
