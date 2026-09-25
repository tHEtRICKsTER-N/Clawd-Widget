// Dump the Guitar Jam energy field (white overlay alpha per cell) for every reference frame (27 fps).
import { computeField, createField } from '../src/engine/grid'
import { pulsesAt } from '../src/engine/timeline'

const out: number[][] = []
const f = createField()
for (let i = 1; i <= 334; i++) {
  const t = (i - 1) / 27
  computeField(t, pulsesAt(t), f)
  out.push(Array.from(f.lit))
}
process.stdout.write(JSON.stringify(out))
