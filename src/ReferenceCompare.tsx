import { useCallback, useEffect, useRef, useState } from 'react'
import { UltracodeButton } from './UltracodeButton'
import { DEFAULT_SETTINGS } from './core/settings'

const ORIGINAL = { ...DEFAULT_SETTINGS, pressFlash: true }
import { CLIP_DURATION, FPS_REF, segmentAt, spriteAt } from './engine/timeline'

const SPEEDS = [0.25, 0.5, 1, 2] as const
type Compare = 'off' | 'stacked' | 'overlay' | 'difference'
const W = 676
const H = 104
const FRAME = 1 / FPS_REF

const params = new URLSearchParams(location.search)
const START_T = params.has('t') ? Math.max(0, +params.get('t')!) : null

export function ReferenceCompare() {
  const [t, setT] = useState(START_T ?? 0)
  const [speed, setSpeed] = useState<number>(1)
  const [playing, setPlaying] = useState(START_T === null)
  const [loopClip, setLoopClip] = useState(true)
  const [compare, setCompare] = useState<Compare>('stacked')
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)
  const [devOpen, setDevOpen] = useState(!params.has('clean'))
  const videoRef = useRef<HTMLVideoElement>(null)
  const clock = useRef({ t: START_T ?? 0, last: 0 })
  const live = useRef({ speed, playing, loopClip })
  live.current = { speed, playing, loopClip }

  // master clock — the button and the reference video both follow it
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      const ck = clock.current
      const L = live.current
      const dt = ck.last ? Math.min(0.1, (now - ck.last) / 1000) : 0
      ck.last = now
      if (L.playing) {
        ck.t += dt * L.speed
        if (L.loopClip && ck.t >= CLIP_DURATION) ck.t = 0
        setT(ck.t)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const seek = useCallback((nt: number) => {
    clock.current.t = Math.max(0, nt)
    setT(clock.current.t)
  }, [])

  // keep the reference video in lock-step
  useEffect(() => {
    const v = videoRef.current
    if (!v || compare === 'off') return
    const inClip = t < v.duration || Number.isNaN(v.duration)
    if (playing && inClip) {
      v.playbackRate = speed
      if (v.paused) void v.play().catch(() => {})
      if (Math.abs(v.currentTime - t) > 0.06 * Math.max(1, speed)) v.currentTime = t
    } else {
      if (!v.paused) v.pause()
      const target = Math.min(t, (v.duration || CLIP_DURATION) - 0.001)
      if (Math.abs(v.currentTime - target) > 0.004) v.currentTime = target
    }
  }, [t, playing, speed, compare])

  // keyboard: space play/pause, ←/→ step one reference frame, 1–4 speeds, 0 restart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setPlaying(false)
        const n = Math.round(clock.current.t / FRAME) + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)
        seek(n * FRAME)
      } else if (e.key >= '1' && e.key <= '4') setSpeed(SPEEDS[+e.key - 1])
      else if (e.key === '0') seek(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seek])

  const frameNo = Math.round(t / FRAME) + 1
  const seg = segmentAt(t)
  const pose = spriteAt(t).frame ?? '—'
  const showRef = devOpen && compare !== 'off'

  return (
    <div className="page compare">
      <div className="top">
        <div className="brand">Reference comparison · Guitar Jam vs the original recording</div>
        <button className="linkish" onClick={() => setDevOpen((d) => !d)}>
          {devOpen ? 'Hide dev mode' : 'Dev mode'}
        </button>
      </div>

      <main className="stage">
        {showRef && compare === 'stacked' && (
          <figure className="lane">
            <figcaption>Reference</figcaption>
            <video ref={videoRef} className="ref" src={`${import.meta.env.BASE_URL}reference.webm`} muted playsInline preload="auto" width={W} height={H} />
          </figure>
        )}

        <figure className="lane">
          {showRef && <figcaption>{compare === 'stacked' ? 'Recreation' : `Recreation × reference (${compare})`}</figcaption>}
          <div className="stack" style={{ width: W, height: H }}>
            <div onClick={() => seek(0)}>
              <UltracodeButton width={W} time={t} settings={ORIGINAL} />
            </div>
            {showRef && compare !== 'stacked' && (
              <video
                ref={videoRef}
                className="ref ref-over"
                src={`${import.meta.env.BASE_URL}reference.webm`}
                muted
                playsInline
                preload="auto"
                width={W}
                height={H}
                style={{
                  opacity: compare === 'overlay' ? overlayOpacity : 1,
                  mixBlendMode: compare === 'difference' ? 'difference' : 'normal',
                }}
              />
            )}
          </div>
        </figure>
      </main>

      {devOpen && (
        <section className="dev" aria-label="Animation test controls">
          <div className="row">
            <button className="btn primary" onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="btn" onClick={() => { setPlaying(false); seek((frameNo - 2) * FRAME) }} title="Previous frame (←)">
              ◀ frame
            </button>
            <button className="btn" onClick={() => { setPlaying(false); seek(frameNo * FRAME) }} title="Next frame (→)">
              frame ▶
            </button>
            <button className="btn" onClick={() => seek(0)} title="Restart (0)">
              Restart
            </button>
            <div className="seg" role="radiogroup" aria-label="Speed">
              {SPEEDS.map((s, i) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={speed === s}
                  className={speed === s ? 'on' : ''}
                  onClick={() => setSpeed(s)}
                  title={`Speed ${s * 100}% (${i + 1})`}
                >
                  {s * 100}%
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <input
              className="scrub"
              type="range"
              min={0}
              max={CLIP_DURATION * 1.5}
              step={FRAME}
              value={t}
              onChange={(e) => { setPlaying(false); seek(+e.target.value) }}
              aria-label="Time"
            />
          </div>

          <div className="row readout">
            <span><b>{t.toFixed(3)}s</b></span>
            <span>ref frame <b>{frameNo}</b> @ {FPS_REF} fps</span>
            <span>move <b>{seg.seg}</b></span>
            <span>pose <b>{pose}</b></span>
            {t > CLIP_DURATION && <span className="muted">past end of reference clip</span>}
          </div>

          <div className="row">
            <div className="seg" role="radiogroup" aria-label="Compare with reference">
              {(['off', 'stacked', 'overlay', 'difference'] as Compare[]).map((c) => (
                <button key={c} role="radio" aria-checked={compare === c} className={compare === c ? 'on' : ''} onClick={() => setCompare(c)}>
                  {c === 'off' ? 'No reference' : c[0].toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
            {compare === 'overlay' && (
              <label className="inline">
                opacity
                <input type="range" min={0} max={1} step={0.05} value={overlayOpacity} onChange={(e) => setOverlayOpacity(+e.target.value)} />
              </label>
            )}
            <label className="inline">
              <input type="checkbox" checked={loopClip} onChange={(e) => setLoopClip(e.target.checked)} />
              loop at clip end ({CLIP_DURATION}s)
            </label>
          </div>
          <p className="hint">Space play/pause · ←/→ step one reference frame (shift ×10) · 1–4 speed · 0 restart</p>
        </section>
      )}
    </div>
  )
}
