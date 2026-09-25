import { front } from '../clawd'
import { pose, type AnimationDef, type AnimId, type Pose } from '../types'
import { code } from './code'
import { dance } from './dance'
import { guitar } from './guitar'
import { hello } from './hello'
import { jump } from './jump'
import { sleep } from './sleep'

export const ANIMATIONS: Record<AnimId, AnimationDef> = { guitar, hello, jump, code, dance, sleep }
export const ANIM_LIST: AnimationDef[] = [guitar, hello, jump, code, dance, sleep]

export function pickRandom(exclude?: AnimId | null): AnimId {
  const pool = ANIM_LIST.filter((a) => a.id !== exclude)
  return pool[Math.floor(Math.random() * pool.length)].id
}

/** Map a running play clock onto an animation's own clock, honouring its loop section. */
export function loopTime(a: AnimationDef, t: number): number {
  if (a.native || t < a.duration) return t
  const span = a.duration - a.loopFrom
  return a.loopFrom + ((t - a.loopFrom) % span)
}

/** Resting state between plays: standing Clawd who blinks and glances around. */
export function idlePose(t: number, blink: boolean): Pose {
  if (!blink) return pose(front(), { name: 'idle' })
  const cycle = 3.7
  const n = Math.floor(t / cycle)
  const u = t - n * cycle
  if (u > 3.56) return pose(front({ eyes: 'closed' }), { name: 'blink' })
  if (n % 3 === 2 && u > 1.2 && u < 2.3) return pose(front({ eyes: u < 1.75 ? 'lookL' : 'lookR' }), { name: 'glance' })
  return pose(front(), { name: 'idle' })
}

export { guitar }
