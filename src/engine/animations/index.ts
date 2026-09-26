import { front, type Gaze } from '../clawd'
import { pose, type AnimationDef, type AnimId, type Pose } from '../types'
import { code } from './code'
import { dance } from './dance'
import { guitar } from './guitar'
import { hello } from './hello'
import { konami } from './konami'
import { jump } from './jump'
import { levelup } from './levelup'
import { ship } from './ship'
import { sleep } from './sleep'
import { snow } from './snow'
import { spooky } from './spooky'
import { squash } from './squash'
import { think } from './think'

export const ANIMATIONS: Record<AnimId, AnimationDef> = { guitar, hello, jump, code, dance, sleep, think, ship, squash, levelup, spooky, snow, konami }
/** always offered (the picker, Random, the menus); the rest are seasonal or secret */
export const ANIM_LIST: AnimationDef[] = [guitar, hello, jump, code, dance, sleep, think, ship, squash, levelup]
/** offered only in their season; playable by id (command line, overlay, export) any time */
export const SEASONAL: AnimationDef[] = [spooky, snow]

/** Is it this animation's season on this date? (always, for the non-seasonal ones) */
export function inSeason(a: AnimationDef, d: Date = new Date()): boolean {
  if (!a.season) return true
  const [m1, d1, m2, d2] = a.season
  const day = (d.getMonth() + 1) * 100 + d.getDate()
  const from = m1 * 100 + d1
  const to = m2 * 100 + d2
  return from <= to ? day >= from && day <= to : day >= from || day <= to
}

/** What the picker, Random and the menus offer on this date: the regulars plus whatever is in season. */
export function offered(d: Date = new Date()): AnimationDef[] {
  return [...ANIM_LIST, ...SEASONAL.filter((a) => inSeason(a, d))]
}

export function pickRandom(exclude?: AnimId | null, d: Date = new Date()): AnimId {
  const pool = offered(d).filter((a) => a.id !== exclude)
  return pool[Math.floor(Math.random() * pool.length)].id
}

/** Map a running play clock onto an animation's own clock, honouring its loop section. */
export function loopTime(a: AnimationDef, t: number): number {
  if (a.native || t < a.duration) return t
  const span = a.duration - a.loopFrom
  return a.loopFrom + ((t - a.loopFrom) % span)
}

const IDLE_CYCLE = 3.7
/** within each idle cycle: blink after this */
const BLINK_AT = 3.56
/** every third cycle: glance left, then right, between these */
const GLANCE = [1.2, 1.75, 2.3] as const

/**
 * Resting state between plays: standing Clawd who blinks and glances around.
 * With a gaze it watches that way instead (still blinking), e.g. towards the cursor.
 */
export function idlePose(t: number, blink: boolean, gaze?: Gaze | null): Pose {
  const n = Math.floor(t / IDLE_CYCLE)
  const u = t - n * IDLE_CYCLE
  if (gaze) {
    if (blink && u > BLINK_AT) return pose(front({ eyes: 'closed' }), { name: 'blink' })
    return pose(front(gaze[0] || gaze[1] ? { gaze } : {}), { name: `watch ${gaze[0]},${gaze[1]}` })
  }
  if (!blink) return pose(front(), { name: 'idle' })
  if (u > BLINK_AT) return pose(front({ eyes: 'closed' }), { name: 'blink' })
  if (n % 3 === 2 && u > GLANCE[0] && u < GLANCE[2]) return pose(front({ eyes: u < GLANCE[1] ? 'lookL' : 'lookR' }), { name: 'glance' })
  return pose(front(), { name: 'idle' })
}

/** Seconds from t until idlePose(t, blink, gaze) can next look different (Infinity: never). */
export function idleNextChange(t: number, blink: boolean, watching: boolean): number {
  if (!blink) return Infinity
  const n = Math.floor(t / IDLE_CYCLE)
  const u = t - n * IDLE_CYCLE
  const marks = !watching && n % 3 === 2 ? [...GLANCE, BLINK_AT, IDLE_CYCLE] : [BLINK_AT, IDLE_CYCLE]
  const m = marks.find((x) => x > u) ?? IDLE_CYCLE
  return m - u + 0.001 // just past the mark, where the pose has changed
}

export { guitar }
