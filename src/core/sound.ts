/**
 * Chiptune sound effects: square waves and noise made with Web Audio on the fly, no audio
 * files. The renderer calls pulse() on the frame an energy pulse starts, so every sound
 * lands with its pulse. Nothing is created until the first sound, and only when the
 * settings turn sound on.
 */

import type { PulseKind } from '../engine/pulses'

/** a major-pentatonic run for strums, in semitones: seeded, so repeats of a riff sound the same */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]
const BASE = 330
const note = (seed: number, octave = 0) => BASE * 2 ** ((SCALE[Math.abs(seed) % SCALE.length] + 12 * octave) / 12)

export class ChipSound {
  /** 0–1 */
  volume = 0.5
  private ctx: BaseAudioContext | null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null

  /** `ctx` is for tests (an OfflineAudioContext); by default a real one is made on first use. */
  constructor(ctx: BaseAudioContext | null = null) {
    this.ctx = ctx
  }

  /** Browsers start audio suspended until a user gesture: call this from click handlers. */
  unlock() {
    const c = this.context()
    if (c instanceof AudioContext && c.state === 'suspended') void c.resume().catch(() => {})
  }

  /** A pulse of this kind and strength just started. */
  pulse(kind: PulseKind, strength: number, seed: number) {
    const c = this.context()
    // still suspended (no gesture yet): drop the sound rather than play a late burst later
    if (!c || !this.master || (c instanceof AudioContext && c.state !== 'running')) return
    this.master.gain.value = Math.max(0, Math.min(1, this.volume))
    const t = c.currentTime + 0.005
    const v = Math.max(0.15, Math.min(1, strength))
    switch (kind) {
      case 'strum':
        this.tone('square', note(seed, 1), t, 0.09, 0.22 * v, note(seed, 1) * 0.97)
        break
      case 'sway':
        this.tone('triangle', note(seed), t, 0.14, 0.3 * v)
        break
      case 'power':
        this.tone('square', note(seed, -1), t, 0.22, 0.18 * v)
        this.tone('square', note(seed, -1) * 1.5, t, 0.22, 0.14 * v)
        this.hiss(t, 0.06, 0.12 * v, 3000)
        break
      case 'first':
        this.tone('square', note(0, -1), t, 0.3, 0.18 * v)
        this.tone('square', note(0, -1) * 1.5, t, 0.3, 0.14 * v)
        this.tone('square', 220, t, 0.28, 0.08 * v, 880)
        break
      case 'land':
        this.tone('square', 160, t, 0.16, 0.28 * v, 55)
        this.hiss(t, 0.08, 0.22 * v, 800)
        break
      case 'twinkle':
        this.tone('square', note(seed, 2), t, 0.05, 0.07 * v)
        break
      case 'scan':
        this.tone('square', 400, t, 0.12, 0.08 * v, 1200)
        break
      case 'soft':
        // the slow breathing glow stays silent
        break
    }
  }

  destroy() {
    if (this.ctx instanceof AudioContext) void this.ctx.close().catch(() => {})
    this.ctx = null
  }

  private context(): BaseAudioContext | null {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      try {
        this.ctx = new AC()
      } catch {
        return null
      }
    }
    if (!this.master) {
      const c = this.ctx
      this.master = c.createGain()
      this.master.connect(c.destination)
      // a second of white noise, shared by every hiss (deterministic, like the visuals)
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate)
      const d = this.noise.getChannelData(0)
      let x = 12345
      for (let i = 0; i < d.length; i++) {
        x = (Math.imul(x, 1103515245) + 12345) | 0
        d[i] = ((x >>> 16) & 0x7fff) / 16384 - 1
      }
    }
    return this.ctx
  }

  /** One oscillator with a pluck envelope, optionally sliding to `to` Hz. */
  private tone(type: OscillatorType, freq: number, t: number, dur: number, gain: number, to?: number) {
    const c = this.ctx!
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  /** A burst of filtered noise (percussion). */
  private hiss(t: number, dur: number, gain: number, cutoff: number) {
    const c = this.ctx!
    const s = c.createBufferSource()
    const f = c.createBiquadFilter()
    const g = c.createGain()
    s.buffer = this.noise
    f.type = 'lowpass'
    f.frequency.value = cutoff
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f).connect(g).connect(this.master!)
    s.start(t)
    s.stop(t + dur + 0.02)
  }
}
