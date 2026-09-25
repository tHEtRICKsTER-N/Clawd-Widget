/**
 * Bug Jump: a tiny runner played on the button. Bugs crawl in from the left along the
 * grid (lighting the cells they pass) and Clawd, running in place, jumps over them.
 * Floating ✓s are worth extra when caught mid-jump. Jumps, landings and catches fire
 * pulses, so with sound on they make sounds too. The label shows the score.
 *
 * Everything is in sprite px (the pose grid) and seconds on the game's own clock.
 * Stateful by nature, so it lives here rather than in the pure engine; `rng` can be
 * seeded for tests.
 */

import { BODY, front } from '../engine/clawd'
import { CELL } from '../engine/grid'
import { CHECK, type Particle } from '../engine/particle'
import { makePulse, type Pulse } from '../engine/pulses'
import { SPRITE_ORIGIN, SPRITE_UNIT } from '../engine/sprites'
import { pose, type Pose } from '../engine/types'

/** where things come from: the button's left edge, in sprite px */
const SPAWN_X = -185
/** Clawd's feet rest on this row; bugs crawl along it */
const GROUND = 24
/** a jump peaks 9 px up (Clawd's head just stays inside the button) and lasts 2·JUMP_V/GRAVITY ≈ 0.63 s */
const GRAVITY = 180
const JUMP_V = 57
const BUG = ['.#.#.', '#####', '.#.#.']
const BUG_W = 5
/** ✓s float this high: only a jump reaches them */
const CHECK_Y = 1
/** seconds before the first bug, and the gap between bugs (at the start) */
const FIRST_BUG = 1.6
const GAP: [number, number] = [1.1, 2.3]
/** bugs never come closer together than this (s): room to land and jump again */
const MIN_GAP = 0.95
/** after a game over: ignore input this long, and give up after this long */
const RETRY_AFTER = 0.6
export const GIVE_UP_AFTER = 8

interface Thing {
  x: number
  /** when it last lit a trail cell (bugs) */
  trailAt: number
  seed: number
}

export interface GameFrame {
  pose: Pose
  particles: Particle[]
  /** on the game clock (`t`) */
  pulses: Pulse[]
  /** what the label shows */
  label: string
}

export class BugJump {
  /** seconds since the game started */
  t = 0
  score = 0
  best: number
  over = false
  private overAt = 0
  private h = 0
  private vy = 0
  private landedAt = -1
  private bugs: Thing[] = []
  private checks: Thing[] = []
  private nextBug = FIRST_BUG
  private pulses: Pulse[] = []
  private seed = 0

  constructor(
    best = 0,
    private rng: () => number = Math.random,
  ) {
    this.best = best
  }

  get speed() {
    return Math.min(160, 60 + 4 * this.score)
  }

  /** Jump (or, after a game over, start again). Returns false if it was ignored. */
  jump(): boolean {
    if (this.over) {
      if (this.t - this.overAt < RETRY_AFTER) return false
      this.reset()
      return true
    }
    if (this.h > 0 || this.vy !== 0) return false
    this.vy = JUMP_V
    this.pulses.push(makePulse(this.t, 'strum', 2000 + this.seed++, { strength: 0.35 }))
    return true
  }

  /** A fresh game (the best score stays). */
  private reset() {
    this.t = 0
    this.score = 0
    this.over = false
    this.overAt = 0
    this.h = 0
    this.vy = 0
    this.landedAt = -1
    this.bugs = []
    this.checks = []
    this.nextBug = FIRST_BUG
    this.pulses = []
  }

  /** Game over long enough ago that the widget should go back to normal. */
  get done() {
    return this.over && this.t - this.overAt > GIVE_UP_AFTER
  }

  step(dt: number): GameFrame {
    this.t += dt
    if (!this.over) this.advance(dt)
    this.pulses = this.pulses.filter((p) => this.t - p.t0 < 1.5)
    return { pose: this.pose(), particles: this.particles(), pulses: this.pulses, label: this.label() }
  }

  private advance(dt: number) {
    // Clawd's jump
    if (this.vy !== 0 || this.h > 0) {
      this.vy -= GRAVITY * dt
      this.h += this.vy * dt
      if (this.h <= 0) {
        this.h = 0
        this.vy = 0
        this.landedAt = this.t
        this.pulses.push(makePulse(this.t, 'land', 2000 + this.seed++, { strength: 0.45 }))
      }
    }
    // spawn: a bug every so often, sometimes a ✓ between bugs
    if (this.t >= this.nextBug) {
      this.bugs.push({ x: SPAWN_X, trailAt: -1, seed: this.seed++ })
      const scale = 60 / this.speed
      const gap = Math.max(MIN_GAP, (GAP[0] + this.rng() * (GAP[1] - GAP[0])) * Math.max(0.55, scale))
      if (this.rng() < 0.35) this.checks.push({ x: SPAWN_X - (gap / 2) * this.speed, trailAt: -1, seed: this.seed++ })
      this.nextBug = this.t + gap
    }
    const v = this.speed
    // hitbox: the legs are a bit narrower than the body, and a bug has to really touch them
    const clawdL = BODY.x0 + 2
    const clawdR = BODY.x1 - 2
    for (const b of this.bugs) {
      b.x += v * dt
      // the cell under the bug glows as it passes
      if (this.t - b.trailAt > 0.12) {
        b.trailAt = this.t
        this.pulses.push(makePulse(this.t, 'trail', 3000 + (this.seed++ % 500), {}, cellAt(b.x + BUG_W / 2, GROUND - 1)))
      }
      // hit: overlapping Clawd while its feet are lower than the bug's back
      if (b.x + BUG_W > clawdL && b.x < clawdR && this.h < 2) {
        this.over = true
        this.overAt = this.t
        this.best = Math.max(this.best, this.score)
        this.pulses.push(makePulse(this.t, 'power', 2000 + this.seed++, { strength: 0.9 }))
        return
      }
    }
    // cleared bugs score
    const before = this.bugs.length
    this.bugs = this.bugs.filter((b) => b.x < clawdR)
    this.score += before - this.bugs.length
    // ✓s: caught when Clawd's head is up at them
    for (const c of this.checks) c.x += v * dt
    this.checks = this.checks.filter((c) => {
      const inX = c.x + CHECK[0].length > clawdL && c.x < clawdR
      const headY = BODY.y0 - this.h
      if (inX && headY <= CHECK_Y + CHECK.length) {
        this.score += 3
        this.pulses.push(makePulse(this.t, 'twinkle', 2000 + this.seed++, { strength: 0.9 }, cellAt(c.x + 2, CHECK_Y + 2)))
        return false
      }
      return c.x < clawdR
    })
    this.best = Math.max(this.best, this.score)
  }

  private pose(): Pose {
    const dy = -Math.round(this.h)
    if (this.over) return pose(front({ eyes: 'wide', left: 'high', right: 'high', dy }), { name: 'bugged' })
    // arms up, not high: at the top of a jump raised arms would leave the button
    if (this.h > 0) return pose(front({ legs: 'air', dy, eyes: 'happy', left: 'up', right: 'up' }), { name: `jump ${dy}` })
    if (this.t - this.landedAt < 0.08) return pose(front({ legs: 'crouch', eyes: 'lookL', left: 'up', right: 'up' }), { name: 'landed' })
    // running in place, eyes on what's coming
    const step = Math.floor(this.t / 0.12) % 2
    return pose(front({ legs: step ? 'stepA' : 'stepB', eyes: 'lookL' }), { name: step ? 'run-a' : 'run-b' })
  }

  private particles(): Particle[] {
    const out: Particle[] = []
    // bugs scuttle: their legs flicker
    for (const b of this.bugs) {
      const legs = Math.floor(this.t / 0.1 + b.seed) % 2
      out.push({ x: Math.round(b.x), y: GROUND - 2, glyph: legs ? BUG : [BUG[2], BUG[1], BUG[0]], color: '#ff4d5e', alpha: 1 })
    }
    for (const c of this.checks) out.push({ x: Math.round(c.x), y: CHECK_Y, glyph: CHECK, color: 'fx', alpha: 1 })
    return out
  }

  private label(): string {
    if (this.over) return `GAME OVER ${this.score} · HI ${this.best} · jump to retry`
    if (this.t < 2.2) return 'BUG JUMP · click or space to jump'
    return `SCORE ${this.score}  HI ${this.best}`
  }
}

/** Grid cell centre under a sprite-px point (for pulses). */
function cellAt(x: number, y: number) {
  return { cx: (SPRITE_ORIGIN.x + x * SPRITE_UNIT) / CELL, cy: (SPRITE_ORIGIN.y + y * SPRITE_UNIT) / CELL }
}
