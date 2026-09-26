import { useEffect, useMemo, useRef } from 'react'
import { ClawdButton, injectButtonCss } from './core/renderer'
import { DEFAULT_SETTINGS, type Settings } from './core/settings'
import type { AnimId } from './engine/types'

export interface UltracodeButtonProps {
  /** full settings (text, font, colours, animation, …); defaults to the original look */
  settings?: Settings
  /** CSS width in px; overrides settings.size */
  width?: number
  speed?: number
  /** Controlled time in seconds (dev / reference comparison). */
  time?: number
  /** animation used with `time` */
  animation?: AnimId
  /** Click plays the animation (default true). */
  playOnClick?: boolean
  className?: string
  /** gets the renderer instance (e.g. to call play() from outside) */
  onReady?: (btn: ClawdButton) => void
  onPlay?: (id: AnimId) => void
}

/** React wrapper around the framework-free ClawdButton renderer. */
export function UltracodeButton({
  settings = DEFAULT_SETTINGS,
  width,
  speed = 1,
  time,
  animation = 'guitar',
  playOnClick = true,
  className,
  onReady,
  onPlay,
}: UltracodeButtonProps) {
  const host = useRef<HTMLDivElement>(null)
  const btn = useRef<ClawdButton | null>(null)
  const merged = useMemo(() => (width ? { ...settings, size: width } : settings), [settings, width])
  const live = useRef({ onPlay })
  live.current = { onPlay }

  useEffect(() => {
    injectButtonCss()
    const b = new ClawdButton(host.current!, merged, { onPlay: (id) => live.current.onPlay?.(id) })
    btn.current = b
    onReady?.(b)
    return () => {
      b.destroy()
      btn.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    btn.current?.setSettings(merged)
  }, [merged])

  useEffect(() => {
    btn.current?.setSpeed(speed)
  }, [speed])

  useEffect(() => {
    btn.current?.setControlled(time ?? null, animation)
  }, [time, animation])

  return (
    <div
      ref={host}
      className={className}
      style={{ display: 'inline-block', lineHeight: 0 }}
      onClick={(e) => playOnClick && time === undefined && btn.current?.click(e.clientX, e.clientY)}
      onKeyDown={(e) => {
        if (playOnClick && time === undefined && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          btn.current?.play()
        }
      }}
    />
  )
}

export default UltracodeButton
