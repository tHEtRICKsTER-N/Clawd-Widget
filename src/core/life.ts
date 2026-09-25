/**
 * Clawd's life between plays: watching the pointer, dangling while dragged, landing,
 * pokes and combos. This is the stateful side, ticked by the renderer whenever no
 * animation is playing; what each reaction looks like is a pure function of time in
 * engine/reactions.ts.
 */

import { idlePose } from '../engine/animations'
import { BODY, type Gaze } from '../engine/clawd'
import type { Particle } from '../engine/particle'
import type { Pulse } from '../engine/pulses'
import {
  CELEBRATE,
  CELEBRATE_EVERY,
  COMBO_WINDOW,
  HEART_LIFE,
  celebrate,
  celebrateParticles,
  celebratePulses,
  comboText,
  dangle,
  drop,
  dropPulse,
  poke,
  pokeHeart,
  pokePulse,
} from '../engine/reactions'
import type { Pose } from '../engine/types'
import type { Settings } from './settings'

/** ms of pointer stillness before Clawd stops watching it and goes back to glancing around */
const WATCH_FOR = 3000

/** Sprite px → client px, for where the button is right now. */
export type SpriteToClient = (col: number, row: number) => [x: number, y: number]

export interface LifeFrame {
  pose: Pose
  /** on the clock passed to frame() */
  pulses: Pulse[]
  particles: Particle[]
}

export class ClawdLife {
  /** seconds of life so far; everything below is timed on this clock */
  private clock = 0
  /** where the pointer was last seen (client px) and when (performance.now() ms) */
  private pointer: { x: number; y: number; at: number } | null = null
  private dragAt: number | null = null
  private dropAt = -Infinity
  private pokeAt = -Infinity
  private combo = 0
  private celebrateAt = -Infinity
  private celebrateSeed = 0
  private hearts: { t0: number; seed: number }[] = []
  private bursts: Pulse[] = []
  private seed = 0

  /** `place` maps sprite px to client px (reads the button's position, so call it sparingly) */
  constructor(private place: () => SpriteToClient) {}

  /** The pointer is at (x, y) in client px. */
  lookAt(x: number, y: number) {
    this.pointer = { x, y, at: performance.now() }
  }

  /** Is the client point (x, y) on Clawd: body or legs, with a pixel of slack? */
  hits(x: number, y: number): boolean {
    const at = this.place()
    const [x0, y0] = at(BODY.x0 - 1, BODY.y0 - 1)
    const [x1, y1] = at(BODY.x1 + 1, BODY.y1 + 4)
    return x >= x0 && x < x1 && y >= y0 && y < y1
  }

  /** The widget started (true) or stopped (false) being dragged. */
  drag(on: boolean) {
    if (on) {
      this.dragAt = this.clock
      this.dropAt = -Infinity
    } else if (this.dragAt !== null) {
      this.dragAt = null
      this.dropAt = this.clock
      this.bursts.push(dropPulse(this.clock, 900 + (this.seed++ % 64)))
    }
  }

  /** Clawd got poked: squish, a heart, a ring that grows with the combo, a celebration every 10. */
  poke() {
    const c = this.clock
    if (c - this.pokeAt > COMBO_WINDOW) this.combo = 0
    this.combo++
    this.pokeAt = c
    const seed = this.seed++
    this.hearts.push({ t0: c, seed })
    this.bursts.push(pokePulse(c, this.combo, 700 + (seed % 64)))
    if (this.combo % CELEBRATE_EVERY === 0) {
      this.celebrateAt = c
      this.celebrateSeed = seed
      this.bursts.push(...celebratePulses(c, 800 + (seed % 64)))
    }
  }

  /** A play is starting: drop whatever was going on. */
  reset() {
    this.dragAt = null
    this.dropAt = this.pokeAt = this.celebrateAt = -Infinity
    this.combo = 0
    this.hearts = []
    this.bursts = []
  }

  /**
   * Advance by dt seconds and say what to show. `idleT` drives the blink cycle and
   * `fieldT` is the clock the grid is on this frame (pulses are moved onto it).
   */
  frame(dt: number, now: number, idleT: number, s: Settings, fieldT: number): LifeFrame {
    const c = (this.clock += dt)
    const pose =
      (this.dragAt !== null ? dangle(c - this.dragAt) : null) ??
      celebrate(c - this.celebrateAt) ??
      poke(c - this.pokeAt) ??
      drop(c - this.dropAt) ??
      idlePose(idleT, s.idleBlink, s.eyesFollow ? this.gaze(now) : null)

    this.hearts = this.hearts.filter((h) => c - h.t0 <= HEART_LIFE)
    const particles: Particle[] = []
    for (const h of this.hearts) {
      const p = pokeHeart(c - h.t0, h.seed)
      if (p) particles.push(p)
    }
    const cel = c - this.celebrateAt
    particles.push(...comboText(this.combo, c - this.pokeAt, cel))
    if (cel < CELEBRATE) particles.push(...celebrateParticles(cel, this.celebrateSeed))

    this.bursts = this.bursts.filter((p) => c - p.t0 < p.life * 1.15)
    const pulses = this.bursts.filter((p) => p.t0 <= c).map((p) => ({ ...p, t0: fieldT - (c - p.t0) }))
    return { pose, pulses, particles }
  }

  /** Which way to look to watch the pointer (null: not watching). */
  private gaze(now: number): Gaze | null {
    const p = this.pointer
    if (!p || now - p.at > WATCH_FOR) return null
    const at = this.place()
    const [x0, y0] = at(BODY.x0, BODY.y0)
    const [x1, y1] = at(BODY.x1, BODY.y1)
    // on its face (or body): look straight at you
    if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) return [0, 0]
    const [ex, ey] = at((BODY.x0 + BODY.x1) / 2, BODY.y0 + 3) // between the eyes
    const a = (Math.round(Math.atan2(p.y - ey, p.x - ex) / (Math.PI / 4)) * Math.PI) / 4
    return [Math.round(Math.cos(a)), Math.round(Math.sin(a))]
  }
}
