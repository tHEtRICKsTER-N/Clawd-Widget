/** The original, reverse-engineered from the reference recording. */

import { particlesAt } from '../particles'
import { FRAMES } from '../sprites'
import { LOOP_PERIOD, LOOP_START, pulsesAt, spriteAt } from '../timeline'
import type { AnimationDef } from '../types'

export const guitar: AnimationDef = {
  id: 'guitar',
  name: 'Guitar Jam',
  icon: '🎸',
  description: 'The original: shreds, sparks and pixel shockwaves',
  duration: LOOP_START + LOOP_PERIOD,
  loopFrom: LOOP_START,
  native: true,
  pressIntro: true,
  pose(t) {
    const s = spriteAt(t)
    return { ...s, frame: s.frame ? FRAMES[s.frame] : null, name: s.frame ?? undefined }
  },
  pulses: (t) => pulsesAt(t),
  particles: (t) => particlesAt(t),
}
