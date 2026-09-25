import { DEFAULT_SETTINGS } from './core/settings'
import { ANIMATIONS } from './engine/animations'
import type { AnimId } from './engine/types'
import { UltracodeButton } from './UltracodeButton'

/** Dev contact sheet: one animation rendered at evenly spaced times (?sheet=hello&step=0.15). */
export function Sheet({ id, step = 0.15 }: { id: AnimId; step?: number }) {
  const a = ANIMATIONS[id]
  const times: number[] = []
  for (let t = 0; t <= a.duration + 1e-6; t += step) times.push(+t.toFixed(3))
  return (
    <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 250px)', gap: 8 }}>
      {times.map((t) => (
        <figure key={t} style={{ margin: 0 }}>
          <UltracodeButton settings={DEFAULT_SETTINGS} width={240} time={t} animation={id} />
          <figcaption style={{ fontSize: 11, color: '#999' }}>{t.toFixed(2)}s</figcaption>
        </figure>
      ))}
    </div>
  )
}
