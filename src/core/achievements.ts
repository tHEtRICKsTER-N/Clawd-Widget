/**
 * Achievements: small goals that unlock things for Clawd to wear. Stats are counted from
 * what happens to the widget (plays, clicks, pokes, drags, waking it up) and saved per
 * host: chrome.storage.local in the extension (never sync, which has write quotas),
 * the app's data file on desktop, localStorage in the playground. Saves are debounced,
 * and pending changes are kept as increments merged into the latest saved stats, so
 * several tabs never overwrite each other's counts.
 */

import { ANIM_LIST } from '../engine/animations'
import type { CosmeticId } from '../engine/cosmetics'
import type { AnimId } from '../engine/types'
import type { StatsStore } from './store'

export interface Stats {
  /** plays per animation id */
  plays: Record<string, number>
  /** clicks on the widget (plays and pokes) */
  clicks: number
  pokes: number
  bestCombo: number
  drags: number
  /** times it was woken up from a doze */
  wakes: number
  /** played between 3 and 4 AM */
  night: boolean
  /** Bug Jump high score */
  bugJumpBest: number
  /** achievement id → when it was unlocked (ms since 1970) */
  unlocked: Record<string, number>
}

/** Something that happened to the widget. */
export type LifeEvent =
  | { type: 'play'; id: AnimId; hour: number }
  | { type: 'click' }
  | { type: 'poke'; combo: number }
  | { type: 'drag' }
  | { type: 'wake' }
  | { type: 'game'; score: number }

export interface Achievement {
  id: string
  name: string
  /** how to get it */
  hint: string
  /** what it unlocks, if anything */
  reward?: CosmeticId
  done(s: Stats): boolean
}

const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-play', name: 'First jam', hint: 'Play Clawd for the first time', reward: 'partyhat', done: (s) => total(s.plays) >= 1 },
  { id: 'combo-10', name: 'Combo ×10', hint: 'Poke Clawd 10 times in a row', reward: 'propeller', done: (s) => s.bestCombo >= 10 },
  { id: 'clicks-100', name: 'Clicker', hint: 'Click the widget 100 times', reward: 'crown', done: (s) => s.clicks >= 100 },
  {
    id: 'collector',
    name: 'Collector',
    hint: 'Play every year-round animation',
    reward: 'shades',
    done: (s) => ANIM_LIST.every((a) => (s.plays[a.id] ?? 0) > 0),
  },
  { id: 'night-owl', name: 'Night owl', hint: 'Play between 3 and 4 AM', reward: 'nightcap', done: (s) => s.night },
  { id: 'cheater', name: 'Cheater!', hint: 'A famous cheat code, typed on the widget', reward: 'headphones', done: (s) => (s.plays.konami ?? 0) > 0 },
  { id: 'flyer', name: 'Frequent flyer', hint: 'Drag the widget around 25 times', done: (s) => s.drags >= 25 },
  { id: 'wake-up', name: 'Rise and shine', hint: 'Wake Clawd from a nap', done: (s) => s.wakes >= 1 },
  { id: 'exterminator', name: 'Exterminator', hint: 'Score 20 in Bug Jump (🎮 in the toolbar)', done: (s) => s.bugJumpBest >= 20 },
]

export const emptyStats = (): Stats => ({ plays: {}, clicks: 0, pokes: 0, bestCombo: 0, drags: 0, wakes: 0, night: false, bugJumpBest: 0, unlocked: {} })

/** Stats from storage (anything missing or broken becomes zero). */
export function normalizeStats(raw: unknown): Stats {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Stats>
  const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0)
  const counts = (r: unknown) => {
    const out: Record<string, number> = {}
    if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) if (n(v)) out[k] = n(v)
    return out
  }
  return {
    plays: counts(s.plays),
    clicks: n(s.clicks),
    pokes: n(s.pokes),
    bestCombo: n(s.bestCombo),
    drags: n(s.drags),
    wakes: n(s.wakes),
    night: s.night === true,
    bugJumpBest: n(s.bugJumpBest),
    unlocked: counts(s.unlocked),
  }
}

/** a + b: counts add up, best combo and high score are the higher one, unlocks keep their earliest time. */
export function mergeStats(a: Stats, b: Stats): Stats {
  const plays = { ...a.plays }
  for (const [k, v] of Object.entries(b.plays)) plays[k] = (plays[k] ?? 0) + v
  const unlocked = { ...a.unlocked }
  for (const [k, v] of Object.entries(b.unlocked)) unlocked[k] = unlocked[k] ? Math.min(unlocked[k], v) : v
  return {
    plays,
    clicks: a.clicks + b.clicks,
    pokes: a.pokes + b.pokes,
    bestCombo: Math.max(a.bestCombo, b.bestCombo),
    drags: a.drags + b.drags,
    wakes: a.wakes + b.wakes,
    night: a.night || b.night,
    bugJumpBest: Math.max(a.bugJumpBest, b.bugJumpBest),
    unlocked,
  }
}

/** Count an event into `d` (a set of increments). */
export function record(d: Stats, e: LifeEvent) {
  if (e.type === 'play') {
    d.plays[e.id] = (d.plays[e.id] ?? 0) + 1
    if (e.hour === 3) d.night = true
  } else if (e.type === 'click') d.clicks++
  else if (e.type === 'poke') {
    d.pokes++
    d.bestCombo = Math.max(d.bestCombo, e.combo)
  } else if (e.type === 'drag') d.drags++
  else if (e.type === 'wake') d.wakes++
  else if (e.type === 'game') d.bugJumpBest = Math.max(d.bugJumpBest, e.score)
}

const SAVE_AFTER = 2000

/** Counts events, notices new achievements and saves the stats now and then. */
export class AchievementTracker {
  /** last stats known to be saved (ours or another tab's) */
  private base = emptyStats()
  /** increments since then */
  private delta = emptyStats()
  private loaded = false
  private timer = 0
  private off: () => void

  constructor(
    private store: StatsStore,
    private onUnlock: (a: Achievement) => void,
  ) {
    void store.load().then((s) => {
      this.base = normalizeStats(s)
      this.loaded = true
    })
    this.off = store.subscribe((s) => (this.base = normalizeStats(s)))
    window.addEventListener('pagehide', this.flushNow)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  get stats(): Stats {
    return mergeStats(this.base, this.delta)
  }

  event(e: LifeEvent) {
    record(this.delta, e)
    // until the saved stats are in, we can't tell what's new (they arrive in a few ms)
    if (this.loaded) {
      const s = this.stats
      for (const a of ACHIEVEMENTS) {
        if (s.unlocked[a.id] || !a.done(s)) continue
        this.delta.unlocked[a.id] = Date.now()
        this.onUnlock(a)
      }
    }
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(this.flushNow, SAVE_AFTER)
  }

  destroy() {
    this.flushNow()
    this.off()
    window.removeEventListener('pagehide', this.flushNow)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flushNow()
  }

  private flushNow = () => {
    window.clearTimeout(this.timer)
    void this.flush()
  }

  private async flush() {
    const d = this.delta
    if (JSON.stringify(d) === JSON.stringify(emptyStats())) return
    this.delta = emptyStats()
    try {
      const next = mergeStats(normalizeStats(await this.store.load()), d)
      this.base = next
      await this.store.save(next)
    } catch {
      // storage unavailable: keep the increments for the next try
      this.delta = mergeStats(d, this.delta)
    }
  }
}
