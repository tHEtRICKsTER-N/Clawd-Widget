/**
 * Clawd's life between plays: watching the pointer, dangling while dragged, landing,
 * pokes and combos, antics now and then, and dozing off when left alone. This is the
 * stateful side, ticked by the renderer whenever no animation is playing; what each
 * reaction looks like is a pure function of time in engine/reactions.ts and
 * engine/antics.ts.
 */

import { idlePose } from '../engine/animations'
import { ANTICS, doze, wake, type Act, type AnticId } from '../engine/antics'
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
/** seconds between antics: a random time in this range */
const ANTIC_GAP: [number, number] = [90, 240]
/** no antics while the pointer was near this recently (seconds): someone is playing with Clawd */
const BUSY_NEAR = 8
/** seconds without the pointer coming near (or a click, drag or play) before Clawd dozes off */
const DOZE_AFTER = 300
/** how close counts as near: sprite px around Clawd */
const NEAR = 24

/** Sprite px → client px, for where the button is right now. */
export type SpriteToClient = (col: number, row: number) => [x: number, y: number]

export interface LifeFrame {
  pose: Pose
  /** on the clock passed to frame() */
  pulses: Pulse[]
  particles: Particle[]
}

const gap = () => ANTIC_GAP[0] + Math.random() * (ANTIC_GAP[1] - ANTIC_GAP[0])

export class ClawdLife {
  /** seconds of life so far; everything below is timed on this clock */
  private clock = 0
  /** where the pointer was last seen (client px) and when (performance.now() ms) */
  private pointer: { x: number; y: number; at: number } | null = null
  /** pointer.at of the last position checked for nearness */
  private checkedAt = -1
  private dragAt: number | null = null
  private dropAt = -Infinity
  private pokeAt = -Infinity
  private combo = 0
  private celebrateAt = -Infinity
  private celebrateSeed = 0
  private hearts: { t0: number; seed: number }[] = []
  private bursts: Pulse[] = []
  private seed = 0
  /** an antic, dozing or waking up, started at `at` */
  private act: { def: Act; at: number } | null = null
  private lastAntic: AnticId | null = null
  private nextAntic = gap()
  /** last time the pointer came near Clawd, or it was clicked, dragged or played */
  private nearAt = 0
  /** sprite px offset of the pose on screen (a wandering Clawd isn't at home) */
  private shownOx = 0

  /** `place` maps sprite px to client px (reads the button's position, so call it sparingly) */
  constructor(private place: () => SpriteToClient) {}

  /** The pointer is at (x, y) in client px. */
  lookAt(x: number, y: number) {
    this.pointer = { x, y, at: performance.now() }
  }

  /** Is the client point (x, y) on Clawd: body or legs, with a pixel of slack? */
  hits(x: number, y: number): boolean {
    const at = this.place()
    const [x0, y0] = at(BODY.x0 - 1 + this.shownOx, BODY.y0 - 1)
    const [x1, y1] = at(BODY.x1 + 1 + this.shownOx, BODY.y1 + 4)
    return x >= x0 && x < x1 && y >= y0 && y < y1
  }

  /** The widget started (true) or stopped (false) being dragged. */
  drag(on: boolean) {
    if (on) {
      this.touch()
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
    this.touch()
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
    this.touch()
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
    let placed: SpriteToClient | null = null
    const place = () => (placed ??= this.place())

    // the pointer coming near keeps Clawd awake, and wakes it up
    const p = this.pointer
    if (p && p.at !== this.checkedAt) {
      this.checkedAt = p.at
      if (this.near(p, place())) this.nearAt = c
    }
    const reaction =
      (this.dragAt !== null ? dangle(c - this.dragAt) : null) ??
      celebrate(c - this.celebrateAt) ??
      poke(c - this.pokeAt) ??
      drop(c - this.dropAt)
    this.updateAct(c, s, !!reaction)

    const act = this.act
    const pose =
      reaction ??
      (act ? act.def.pose(c - act.at) : null) ??
      idlePose(idleT, s.idleBlink, s.eyesFollow ? this.gaze(now, place) : null)
    this.shownOx = pose.ox

    this.hearts = this.hearts.filter((h) => c - h.t0 <= HEART_LIFE)
    const particles: Particle[] = []
    for (const h of this.hearts) {
      const heart = pokeHeart(c - h.t0, h.seed)
      if (heart) particles.push(heart)
    }
    const cel = c - this.celebrateAt
    particles.push(...comboText(this.combo, c - this.pokeAt, cel))
    if (cel < CELEBRATE) particles.push(...celebrateParticles(cel, this.celebrateSeed))

    this.bursts = this.bursts.filter((b) => c - b.t0 < b.life * 1.15)
    const pulses = this.bursts.filter((b) => b.t0 <= c).map((b) => ({ ...b, t0: fieldT - (c - b.t0) }))
    if (act) {
      // the act's pulses are on its own clock
      const t = c - act.at
      particles.push(...act.def.particles(t))
      for (const b of act.def.pulses(t)) pulses.push({ ...b, t0: fieldT - (t - b.t0) })
    }
    return { pose, pulses, particles }
  }

  /** Start, end and switch antics, dozing and waking up. `busy`: a reaction is showing. */
  private updateAct(c: number, s: Settings, busy: boolean) {
    const act = this.act
    if (!s.idleAntics) {
      this.act = null
      this.nearAt = c // nobody dozes off while antics are off
      return
    }
    if (act?.def === doze && this.nearAt > act.at) {
      this.act = { def: wake, at: c }
    } else if (act && c - act.at >= act.def.duration) {
      this.act = null
      this.nextAntic = c + gap()
    }
    if (this.act || busy) return
    if (c - this.nearAt > DOZE_AFTER) {
      this.act = { def: doze, at: c }
    } else if (c >= this.nextAntic) {
      if (c - this.nearAt < BUSY_NEAR) {
        this.nextAntic = c + 5
        return
      }
      const ids = (Object.keys(ANTICS) as AnticId[]).filter((id) => id !== this.lastAntic)
      const id = ids[Math.floor(Math.random() * ids.length)]
      this.lastAntic = id
      this.act = { def: ANTICS[id], at: c }
    }
  }

  /** Clicked, dragged or played: counts as company, and ends any antic, doze or wake-up. */
  private touch() {
    this.nearAt = this.clock
    if (this.act) this.nextAntic = this.clock + gap()
    this.act = null
  }

  /** Is the pointer within NEAR sprite px of Clawd (at home)? */
  private near(p: { x: number; y: number }, at: SpriteToClient): boolean {
    const [x0, y0] = at(BODY.x0 - NEAR, BODY.y0 - NEAR)
    const [x1, y1] = at(BODY.x1 + NEAR, BODY.y1 + 4 + NEAR)
    return p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1
  }

  /** Which way to look to watch the pointer (null: not watching). */
  private gaze(now: number, place: () => SpriteToClient): Gaze | null {
    const p = this.pointer
    if (!p || now - p.at > WATCH_FOR) return null
    const at = place()
    const [x0, y0] = at(BODY.x0, BODY.y0)
    const [x1, y1] = at(BODY.x1, BODY.y1)
    // on its face (or body): look straight at you
    if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) return [0, 0]
    const [ex, ey] = at((BODY.x0 + BODY.x1) / 2, BODY.y0 + 3) // between the eyes
    const a = (Math.round(Math.atan2(p.y - ey, p.x - ex) / (Math.PI / 4)) * Math.PI) / 4
    return [Math.round(Math.cos(a)), Math.round(Math.sin(a))]
  }
}
