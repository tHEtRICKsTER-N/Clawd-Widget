import { useEffect, useMemo, useState } from 'react'
import { localStatsStore, localStore } from './core/store'
import { DEFAULT_DOCK, FloatingWidget, type Dock } from './core/widget'
import { ReferenceCompare } from './ReferenceCompare'
import { SettingsPanel } from './settings-ui/SettingsPanel'
import { Sheet } from './Sheet'
import type { AnimId } from './engine/types'

type Tab = 'playground' | 'compare'
const params = new URLSearchParams(location.search)
const DOCK_KEY = 'clawdDock'

function loadDock(): Dock {
  try {
    return { ...DEFAULT_DOCK, ...JSON.parse(localStorage.getItem(DOCK_KEY) || '{}') }
  } catch {
    return DEFAULT_DOCK
  }
}

/** The same floating widget the extension injects, living on this page. */
function PageWidget() {
  const store = useMemo(() => localStore(), [])
  useEffect(() => {
    let w: FloatingWidget | null = null
    let alive = true
    let off = () => {}
    void store.load().then((s) => {
      if (!alive) return
      w = new FloatingWidget({
        mode: 'page',
        settings: s,
        dock: loadDock(),
        onDock: (d) => localStorage.setItem(DOCK_KEY, JSON.stringify(d)),
        onClose: () => w?.host.style.setProperty('display', 'none'),
        closeLabel: 'Hide (reload to bring back)',
        onPatch: (p) => w && void store.save({ ...w.settings, ...p }),
        stats: localStatsStore(),
      })
      off = store.subscribe((v) => w?.setSettings(v))
    })
    return () => {
      alive = false
      off()
      w?.destroy()
    }
  }, [store])
  return null
}

export default function App() {
  if (params.has('sheet')) return <Sheet id={params.get('sheet') as AnimId} step={+(params.get('step') || 0.15)} />
  return <Main />
}

function Main() {
  const [tab, setTab] = useState<Tab>(params.has('t') || params.get('tab') === 'compare' ? 'compare' : 'playground')
  const store = useMemo(() => localStore(), [])
  const stats = useMemo(() => localStatsStore(), [])

  return (
    <div className="shell">
      <header className="shell-top">
        <div className="shell-brand">Clawd button</div>
        <nav className="seg" aria-label="View">
          <button className={tab === 'playground' ? 'on' : ''} onClick={() => setTab('playground')}>
            Playground
          </button>
          <button className={tab === 'compare' ? 'on' : ''} onClick={() => setTab('compare')}>
            Reference compare
          </button>
        </nav>
      </header>

      {tab === 'playground' ? (
        <main className="playground">
          <p className="lede">
            Customize it here. The floating widget in the corner is the same one the browser extension and desktop app use: drag it anywhere, and it
            docks to the nearest edge. Click to play.
          </p>
          <SettingsPanel store={store} host="web" stats={stats} />
          <PageWidget />
        </main>
      ) : (
        <ReferenceCompare />
      )}
    </div>
  )
}
