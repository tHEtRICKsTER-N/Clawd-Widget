/**
 * Settings persistence adapters. The same settings UI and widget code run in
 * three hosts, each with its own storage:
 *   - browser extension → chrome.storage.sync (synced across the user's browsers)
 *   - desktop widget    → Electron main process (JSON file in userData), via preload IPC
 *   - web demo          → localStorage
 */

import { normalize, type Settings } from './settings'

export interface SettingsStore {
  load(): Promise<Settings>
  save(s: Settings): Promise<void>
  /** called when settings change elsewhere (other tab, popup, settings window) */
  subscribe(cb: (s: Settings) => void): () => void
}

const KEY = 'clawdSettings'

const localListeners = new Set<(s: Settings) => void>()

export function localStore(): SettingsStore {
  return {
    async load() {
      try {
        return normalize(JSON.parse(localStorage.getItem(KEY) || '{}'))
      } catch {
        return normalize({})
      }
    },
    async save(s) {
      try {
        localStorage.setItem(KEY, JSON.stringify(s))
      } catch {
        /* storage unavailable (private mode) — keep working in memory */
      }
      localListeners.forEach((cb) => cb(s))
    },
    subscribe(cb) {
      const on = (e: StorageEvent) => {
        if (e.key === KEY && e.newValue) cb(normalize(JSON.parse(e.newValue)))
      }
      window.addEventListener('storage', on)
      localListeners.add(cb)
      return () => {
        window.removeEventListener('storage', on)
        localListeners.delete(cb)
      }
    },
  }
}

export function chromeStore(): SettingsStore {
  return {
    async load() {
      const r = await chrome.storage.sync.get(KEY)
      return normalize(r[KEY])
    },
    async save(s) {
      await chrome.storage.sync.set({ [KEY]: s })
    },
    subscribe(cb) {
      const on = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === 'sync' && changes[KEY]) cb(normalize(changes[KEY].newValue))
      }
      chrome.storage.onChanged.addListener(on)
      return () => chrome.storage.onChanged.removeListener(on)
    },
  }
}

/**
 * Where achievement stats live (see achievements.ts). Not settings: they change often,
 * so in the extension they go to chrome.storage.local, never to the rate-limited sync.
 */
export interface StatsStore {
  load(): Promise<unknown>
  save(stats: unknown): Promise<void>
  /** called when the stats change elsewhere (another tab, the settings window) */
  subscribe(cb: (stats: unknown) => void): () => void
}

const STATS_KEY = 'clawdStats'
/** same-page listeners (the storage event only reaches other tabs) */
const statsListeners = new Set<(s: unknown) => void>()

export function localStatsStore(): StatsStore {
  return {
    async load() {
      try {
        return JSON.parse(localStorage.getItem(STATS_KEY) || '{}')
      } catch {
        return {}
      }
    },
    async save(s) {
      try {
        localStorage.setItem(STATS_KEY, JSON.stringify(s))
      } catch {
        /* storage unavailable */
      }
      statsListeners.forEach((cb) => cb(s))
    },
    subscribe(cb) {
      const on = (e: StorageEvent) => {
        if (e.key === STATS_KEY && e.newValue) cb(JSON.parse(e.newValue))
      }
      window.addEventListener('storage', on)
      statsListeners.add(cb)
      return () => {
        window.removeEventListener('storage', on)
        statsListeners.delete(cb)
      }
    },
  }
}

export function chromeStatsStore(): StatsStore {
  return {
    async load() {
      return (await chrome.storage.local.get(STATS_KEY))[STATS_KEY] ?? {}
    },
    async save(s) {
      await chrome.storage.local.set({ [STATS_KEY]: s })
    },
    subscribe(cb) {
      const on = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === 'local' && changes[STATS_KEY]) cb(changes[STATS_KEY].newValue)
      }
      chrome.storage.onChanged.addListener(on)
      return () => chrome.storage.onChanged.removeListener(on)
    },
  }
}

export function desktopStatsStore(): StatsStore {
  const api = window.clawdDesktop!
  return { load: () => api.getStats(), save: (s) => api.setStats(s), subscribe: (cb) => api.onStats(cb) }
}

/** API exposed by desktop/preload.cjs */
export interface DesktopLayout {
  /** where the hover toolbar goes: above the button, or below it near the top of the screen */
  bar: 'top' | 'bottom'
}

export interface DesktopBridge {
  getSettings(): Promise<unknown>
  setSettings(s: Settings): Promise<void>
  onSettings(cb: (s: unknown) => void): () => void
  getLayout(): Promise<DesktopLayout>
  onLayout(cb: (l: DesktopLayout) => void): () => void
  /** mouse position anywhere on screen, in window coordinates (sent while eyes follow the cursor) */
  onCursor(cb: (x: number, y: number) => void): () => void
  /** main process follows the cursor from dragStart until dragEnd */
  dragStart(): void
  dragEnd(): void
  setClickThrough(on: boolean): void
  openSettings(): void
  /** open the native menu at this point (window coordinates) */
  showMenu(x: number, y: number): void
  hide(): void
  onCommand(cb: (cmd: string, arg?: string) => void): () => void
  getStats(): Promise<unknown>
  setStats(s: unknown): Promise<void>
  onStats(cb: (s: unknown) => void): () => void
}

declare global {
  interface Window {
    clawdDesktop?: DesktopBridge
  }
}

export function desktopStore(): SettingsStore {
  const api = window.clawdDesktop!
  return {
    load: async () => normalize(await api.getSettings()),
    save: (s) => api.setSettings(s),
    subscribe: (cb) => api.onSettings((s) => cb(normalize(s))),
  }
}

/** Pick the right store for whatever host we're running in. */
export function autoStore(): SettingsStore {
  if (typeof window !== 'undefined' && window.clawdDesktop) return desktopStore()
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) return chromeStore()
  return localStore()
}
