import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ClawdButton } from '../core/renderer'
import { DEFAULT_SETTINGS, FONTS, PRESETS, SIZES, type Colors, type Settings } from '../core/settings'
import type { SettingsStore } from '../core/store'
import { ANIM_LIST } from '../engine/animations'
import { UltracodeButton } from '../UltracodeButton'
import './settings.css'

export interface SettingsPanelProps {
  store: SettingsStore
  host: 'web' | 'extension' | 'desktop'
  /** narrow layout for the extension popup */
  compact?: boolean
  /** extension popup: hostname of the active tab */
  currentSite?: string
  /** extra host-specific controls rendered at the end */
  extra?: ReactNode
}

const COLOR_FIELDS: { key: keyof Colors; label: string; group: 'button' | 'bot' | 'effects' }[] = [
  { key: 'background', label: 'Background', group: 'button' },
  { key: 'glow', label: 'Background glow', group: 'button' },
  { key: 'text', label: 'Text', group: 'button' },
  { key: 'bot', label: 'Bot', group: 'bot' },
  { key: 'energy', label: 'Energy cells', group: 'effects' },
  { key: 'effectGlow', label: 'Energy glow', group: 'effects' },
  { key: 'particles', label: 'Notes & sparks', group: 'effects' },
]

export function SettingsPanel({ store, host, compact, currentSite, extra }: SettingsPanelProps) {
  const [s, setS] = useState<Settings | null>(null)
  const btn = useRef<ClawdButton | null>(null)
  const saveTimer = useRef<number>(0)
  const pending = useRef<Settings | null>(null)

  useEffect(() => {
    let alive = true
    void store.load().then((v) => alive && setS(v))
    const off = store.subscribe((v) => {
      if (!pending.current) setS(v)
    })
    return () => {
      alive = false
      off()
    }
  }, [store])

  // flush a pending save when the popup / window closes
  useEffect(() => {
    const flush = () => {
      if (pending.current) void store.save(pending.current)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [store])

  if (!s) return <div className="sp sp-loading">Loading…</div>

  const update = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch }
    setS(next)
    pending.current = next
    // debounce: colour pickers fire continuously, and chrome.storage.sync has write quotas
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const v = pending.current
      pending.current = null
      if (v) void store.save(v)
    }, 350)
  }
  const setColor = (key: keyof Colors, v: string) => update({ colors: { ...s.colors, [key]: v } })
  const presetId = PRESETS.find((p) => (Object.keys(p.colors) as (keyof Colors)[]).every((k) => p.colors[k] === s.colors[k]))?.id
  const previewWidth = compact ? 340 : Math.min(466, s.size < 300 ? 340 : 466)
  const hidden = currentSite ? s.hiddenSites.includes(currentSite) : false

  return (
    <div className={compact ? 'sp compact' : 'sp'}>
      <section className="sp-preview">
        <UltracodeButton settings={s} width={previewWidth} onReady={(b) => (btn.current = b)} />
        <div className="sp-row">
          <button className="sp-btn primary" onClick={() => btn.current?.play()}>
            ▶ Play
          </button>
          <button className="sp-btn" onClick={() => btn.current?.play('random')}>
            🎲 Random
          </button>
          <span className="sp-hint">Click the button to play it</span>
        </div>
      </section>

      {host === 'extension' && currentSite && (
        <section className="sp-card sp-site">
          <div>
            <div className="sp-title">On {currentSite}</div>
            <div className="sp-sub">{!s.enabled ? 'Widget is turned off everywhere' : hidden ? 'Hidden on this site' : 'Showing on this site'}</div>
          </div>
          <button
            className="sp-btn"
            disabled={!s.enabled}
            onClick={() =>
              update({ hiddenSites: hidden ? s.hiddenSites.filter((h) => h !== currentSite) : [...s.hiddenSites, currentSite] })
            }
          >
            {hidden ? 'Show here' : 'Hide here'}
          </button>
        </section>
      )}

      <section className="sp-card">
        <h3>Text</h3>
        <label className="sp-field">
          <span>Label</span>
          <input value={s.text} maxLength={40} onChange={(e) => update({ text: e.target.value })} placeholder="Ultracode" />
        </label>
        <div className="sp-grid2">
          <label className="sp-field">
            <span>Font</span>
            <select value={s.font} onChange={(e) => update({ font: e.target.value as Settings['font'] })}>
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="sp-check">
            <input type="checkbox" checked={s.bold} onChange={(e) => update({ bold: e.target.checked })} />
            Bold
          </label>
        </div>
        {s.font === 'custom' && (
          <label className="sp-field">
            <span>Installed font name</span>
            <input value={s.customFont} onChange={(e) => update({ customFont: e.target.value })} placeholder="e.g. Comic Sans MS, Fira Code" />
          </label>
        )}
      </section>

      <section className="sp-card">
        <h3>Animation</h3>
        <div className="sp-anims" role="radiogroup" aria-label="Animation">
          {ANIM_LIST.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={s.animation === a.id}
              className={s.animation === a.id ? 'sp-anim on' : 'sp-anim'}
              title={a.description}
              onClick={() => {
                update({ animation: a.id })
                btn.current?.play(a.id)
              }}
            >
              <span className="sp-anim-icon">{a.icon}</span>
              <span className="sp-anim-name">{a.name}</span>
            </button>
          ))}
          <button
            role="radio"
            aria-checked={s.animation === 'random'}
            className={s.animation === 'random' ? 'sp-anim on' : 'sp-anim'}
            title="A different animation on every click"
            onClick={() => {
              update({ animation: 'random' })
              btn.current?.play('random')
            }}
          >
            <span className="sp-anim-icon">🎲</span>
            <span className="sp-anim-name">Random</span>
          </button>
        </div>
        <div className="sp-row">
          <div className="sp-seg" role="radiogroup" aria-label="When clicked">
            <button role="radio" aria-checked={s.playMode === 'once'} className={s.playMode === 'once' ? 'on' : ''} onClick={() => update({ playMode: 'once' })}>
              Play once
            </button>
            <button role="radio" aria-checked={s.playMode === 'loop'} className={s.playMode === 'loop' ? 'on' : ''} onClick={() => update({ playMode: 'loop' })}>
              Loop
            </button>
          </div>
          <label className="sp-check">
            <input type="checkbox" checked={s.idleBlink} onChange={(e) => update({ idleBlink: e.target.checked })} />
            Blink when idle
          </label>
          <label className="sp-check" title={host === 'desktop' ? 'Clawd watches the mouse anywhere on screen while resting' : 'Clawd watches the pointer while resting'}>
            <input type="checkbox" checked={s.eyesFollow} onChange={(e) => update({ eyesFollow: e.target.checked })} />
            Eyes follow cursor
          </label>
          <label className="sp-check" title="Guitar Jam starts with the dark 'pressed' flash from the original">
            <input type="checkbox" checked={s.pressFlash} onChange={(e) => update({ pressFlash: e.target.checked })} />
            Tap flash
          </label>
        </div>
      </section>

      <section className="sp-card">
        <h3>Colors</h3>
        <div className="sp-presets">
          {PRESETS.map((p) => (
            <button key={p.id} className={presetId === p.id ? 'sp-preset on' : 'sp-preset'} onClick={() => update({ colors: { ...p.colors } })} title={p.name}>
              <span className="sw" style={{ background: `linear-gradient(90deg, ${p.colors.background} 0 50%, ${p.colors.glow} 50%)` }} />
              <span className="dot" style={{ background: p.colors.bot }} />
              <span className="dot" style={{ background: p.colors.particles }} />
              <span className="nm">{p.name}</span>
            </button>
          ))}
        </div>
        {(['button', 'bot', 'effects'] as const).map((grp) => (
          <div key={grp} className="sp-colors">
            <div className="sp-sub">{grp === 'button' ? 'Button' : grp === 'bot' ? 'Bot' : 'Effects'}</div>
            {COLOR_FIELDS.filter((c) => c.group === grp).map((c) => (
              <label key={c.key} className="sp-color">
                <input type="color" value={s.colors[c.key]} onChange={(e) => setColor(c.key, e.target.value)} />
                <span>{c.label}</span>
                <code>{s.colors[c.key]}</code>
              </label>
            ))}
          </div>
        ))}
      </section>

      <section className="sp-card">
        <h3>Widget</h3>
        <div className="sp-row">
          <span className="sp-label">Size</span>
          <div className="sp-seg" role="radiogroup" aria-label="Size">
            {SIZES.map((z) => (
              <button key={z.value} role="radio" aria-checked={s.size === z.value} className={s.size === z.value ? 'on' : ''} onClick={() => update({ size: z.value })}>
                {z.label}
              </button>
            ))}
          </div>
          <label className="sp-check">
            <input type="checkbox" checked={s.showToolbar} onChange={(e) => update({ showToolbar: e.target.checked })} />
            Hover toolbar
          </label>
          <label className="sp-check" title="Clawd dangles while you drag the widget and lands with a thud">
            <input type="checkbox" checked={s.dragReact} onChange={(e) => update({ dragReact: e.target.checked })} />
            Dangle when dragged
          </label>
        </div>
        {host === 'extension' && (
          <>
            <label className="sp-check">
              <input type="checkbox" checked={s.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
              Show the widget on web pages
            </label>
            {s.hiddenSites.length > 0 && (
              <div className="sp-sites">
                <div className="sp-sub">Hidden on</div>
                {s.hiddenSites.map((h) => (
                  <span key={h} className="sp-chip">
                    {h}
                    <button aria-label={`Show on ${h}`} onClick={() => update({ hiddenSites: s.hiddenSites.filter((x) => x !== h) })}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {extra}
      </section>

      <footer className="sp-foot">
        <button
          className="sp-btn ghost"
          onClick={() => update({ ...DEFAULT_SETTINGS, enabled: s.enabled, hiddenSites: s.hiddenSites })}
        >
          Reset look to defaults
        </button>
      </footer>
    </div>
  )
}
