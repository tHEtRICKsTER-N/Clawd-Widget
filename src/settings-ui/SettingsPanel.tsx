import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ClawdButton } from '../core/renderer'
import { DEFAULT_SETTINGS, FONTS, PRESETS, SIZES, parseThemeCode, themeCode, type Colors, type Settings } from '../core/settings'
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

/** The theme as a short code to copy, and a field to paste someone else's. */
function ShareCode({ s, onApply }: { s: Settings; onApply: (t: { colors: Colors; crt: boolean }) => void }) {
  const code = themeCode(s)
  const mine = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const [paste, setPaste] = useState('')
  const theirs = paste.trim() ? parseThemeCode(paste) : null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // no clipboard access here: select it for a manual copy
      mine.current?.select()
    }
  }
  return (
    <div className="sp-share">
      <div className="sp-sub">Share code</div>
      <div className="sp-share-row">
        <input ref={mine} className="sp-code" readOnly value={code} onFocus={(e) => e.target.select()} aria-label="Share code for this theme" />
        <button className="sp-btn" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="sp-share-row">
        <input className="sp-code" value={paste} placeholder="Paste a code to use its theme" onChange={(e) => setPaste(e.target.value)} aria-label="Paste a share code" />
        <button
          className="sp-btn"
          disabled={!theirs}
          onClick={() => {
            if (!theirs) return
            onApply(theirs)
            setPaste('')
          }}
        >
          Use
        </button>
      </div>
      {paste.trim() && !theirs && <span className="sp-hint">That isn't a Clawd theme code.</span>}
    </div>
  )
}

/** Whether the system asks for reduced motion (the button then tones itself down). */
function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const m = matchMedia(query)
    const f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return on
}

export function SettingsPanel({ store, host, compact, currentSite, extra }: SettingsPanelProps) {
  const [s, setS] = useState<Settings | null>(null)
  const reducedMotion = useReducedMotion()
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
  // sound needs a click to start in browsers: every play button here counts
  const playPreview = (id?: Parameters<ClawdButton['play']>[0]) => {
    btn.current?.unlockSound()
    btn.current?.play(id)
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
          <button className="sp-btn primary" onClick={() => playPreview()}>
            ▶ Play
          </button>
          <button className="sp-btn" onClick={() => playPreview('random')}>
            🎲 Random
          </button>
          <span className="sp-hint">{s.pokes ? 'Click the button to play it, or poke Clawd' : 'Click the button to play it'}</span>
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
                playPreview(a.id)
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
              playPreview('random')
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
          <label className="sp-check" title="Guitar Jam starts with the dark 'pressed' flash from the original">
            <input type="checkbox" checked={s.pressFlash} onChange={(e) => update({ pressFlash: e.target.checked })} />
            Tap flash
          </label>
        </div>
        {reducedMotion && (
          <p className="sp-hint">
            Your system asks for reduced motion, so the grid flashes at most 3 times a second and less brightly, the tap flash is skipped and
            Clawd's eyes move calmly.
          </p>
        )}
      </section>

      <section className="sp-card">
        <h3>Between plays</h3>
        <div className="sp-row">
          <label className="sp-check">
            <input type="checkbox" checked={s.idleBlink} onChange={(e) => update({ idleBlink: e.target.checked })} />
            Blink when idle
          </label>
          <label className="sp-check" title={host === 'desktop' ? 'Clawd watches the mouse anywhere on screen while resting' : 'Clawd watches the pointer while resting'}>
            <input type="checkbox" checked={s.eyesFollow} onChange={(e) => update({ eyesFollow: e.target.checked })} />
            Eyes follow cursor
          </label>
          <label className="sp-check" title="Clawd dangles while you drag the widget and lands with a thud">
            <input type="checkbox" checked={s.dragReact} onChange={(e) => update({ dragReact: e.target.checked })} />
            Dangle when dragged
          </label>
          <label className="sp-check" title="Clicking Clawd itself gets a squish and a heart instead of playing. Keep poking for a combo.">
            <input type="checkbox" checked={s.pokes} onChange={(e) => update({ pokes: e.target.checked })} />
            Poke Clawd
          </label>
          <label className="sp-check" title="Every few minutes Clawd stretches, yawns, scratches or wanders off. Left alone for a while, it dozes off, and wakes when the pointer comes near.">
            <input type="checkbox" checked={s.idleAntics} onChange={(e) => update({ idleAntics: e.target.checked })} />
            Idle antics
          </label>
        </div>
      </section>

      <section className="sp-card">
        <h3>Sound</h3>
        <div className="sp-row">
          <label className="sp-check">
            <input
              type="checkbox"
              checked={s.sound}
              onChange={(e) => {
                update({ sound: e.target.checked })
                if (e.target.checked) btn.current?.unlockSound(true)
              }}
            />
            Sound effects
          </label>
          <label className="sp-range">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(s.volume * 100)}
              disabled={!s.sound}
              onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            />
            <code>{Math.round(s.volume * 100)}%</code>
          </label>
        </div>
        <p className="sp-hint">Chiptune blips made on the fly, in time with every pulse of the grid. Off until you turn it on.</p>
      </section>

      <section className="sp-card">
        <h3>Colors</h3>
        {([undefined, 'games'] as const).map((group) => (
          <div key={group ?? 'classic'} className="sp-preset-group">
            <div className="sp-sub">{group ? 'Games & editors' : 'Classic'}</div>
            <div className="sp-presets">
              {PRESETS.filter((p) => p.group === group).map((p) => (
                <button key={p.id} className={presetId === p.id ? 'sp-preset on' : 'sp-preset'} onClick={() => update({ colors: { ...p.colors } })} title={p.name}>
                  <span className="sw" style={{ background: `linear-gradient(90deg, ${p.colors.background} 0 50%, ${p.colors.glow} 50%)` }} />
                  <span className="dot" style={{ background: p.colors.bot }} />
                  <span className="dot" style={{ background: p.colors.particles }} />
                  <span className="nm">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <label className="sp-check" title="Scanlines and a soft vignette, like an old CRT screen">
          <input type="checkbox" checked={s.crt} onChange={(e) => update({ crt: e.target.checked })} />
          CRT scanlines
        </label>
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
        <ShareCode s={s} onApply={(t) => update({ colors: t.colors, crt: t.crt })} />
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
