/**
 * Content script: puts the floating Clawd widget on every page (in a shadow root,
 * so it never inherits or leaks page styles). Settings come from chrome.storage.sync
 * and update live; the dock position is shared across tabs via chrome.storage.local.
 */

import type { Settings } from '../../src/core/settings'
import { chromeStatsStore, chromeStore } from '../../src/core/store'
import { DEFAULT_DOCK, FloatingWidget, type Dock } from '../../src/core/widget'
import type { AnimId } from '../../src/engine/types'

const DOCK_KEY = 'clawdDock'
const site = location.hostname || 'local files'
const store = chromeStore()

let settings: Settings | null = null
let dock: Dock = DEFAULT_DOCK
let widget: FloatingWidget | null = null
/** toggled off with the keyboard shortcut for this page only */
let sessionHidden = false

const wanted = () => !!settings && settings.enabled && !settings.hiddenSites.includes(site) && !sessionHidden

function sync() {
  if (!wanted()) {
    widget?.destroy()
    widget = null
    return
  }
  if (widget) {
    widget.setSettings(settings!)
    return
  }
  widget = new FloatingWidget({
    mode: 'page',
    settings: settings!,
    dock,
    onDock: (d) => {
      dock = d
      void chrome.storage.local.set({ [DOCK_KEY]: d })
    },
    onOpenSettings: () => void chrome.runtime.sendMessage({ type: 'open-options' }),
    onClose: () => {
      if (settings) void store.save({ ...settings, hiddenSites: [...settings.hiddenSites, site] })
    },
    closeLabel: `Hide on ${site} (bring it back from the toolbar icon)`,
    onPatch: (p) => {
      if (settings) void store.save({ ...settings, ...p })
    },
    stats: chromeStatsStore(),
  })
}

async function init() {
  if (window.top !== window) return
  const [s, local] = await Promise.all([store.load(), chrome.storage.local.get(DOCK_KEY)])
  settings = s
  if (local[DOCK_KEY]) dock = { ...DEFAULT_DOCK, ...local[DOCK_KEY] }
  sync()

  store.subscribe((v) => {
    settings = v
    sync()
  })
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[DOCK_KEY]?.newValue) {
      dock = { ...DEFAULT_DOCK, ...changes[DOCK_KEY].newValue }
      widget?.setDock(dock)
    }
  })
  chrome.runtime.onMessage.addListener((msg: { type?: string; id?: AnimId | 'random' }) => {
    if (msg?.type === 'toggle') {
      sessionHidden = !sessionHidden
      sync()
    } else if (msg?.type === 'play') {
      if (sessionHidden) {
        sessionHidden = false
        sync()
      }
      widget?.play(msg.id)
    }
  })
}

void init()
