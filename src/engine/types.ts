import type { Particle } from './particle'
import type { Pulse } from './pulses'
import type { SpriteFrame } from './sprites'

export type AnimId = 'guitar' | 'hello' | 'jump' | 'code' | 'dance' | 'sleep' | 'think'

export interface Pose {
  frame: SpriteFrame | null
  /** pixel-snapped pop-in scale (1 = normal) */
  scale: number
  opacity: number
  /** extra offset in sprite px */
  ox: number
  oy: number
  /** debug name shown in dev mode */
  name?: string
}

export interface AnimationDef {
  id: AnimId
  name: string
  icon: string
  description: string
  /** length of one play, seconds */
  duration: number
  /** when looping, repeat [loopFrom, duration) */
  loopFrom: number
  /** the functions already loop by themselves as t grows (no remapping needed) */
  native?: boolean
  /** start with the dark "pressed" flash + purple settle of the reference */
  pressIntro?: boolean
  pose(t: number): Pose
  pulses(t: number): Pulse[]
  particles(t: number): Particle[]
}

export const pose = (frame: SpriteFrame | null, o: Partial<Pose> = {}): Pose => ({
  frame,
  scale: 1,
  opacity: 1,
  ox: 0,
  oy: 0,
  ...o,
})
