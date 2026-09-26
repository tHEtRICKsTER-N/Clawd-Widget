/**
 * Export any animation, in the current look, at any size: an animated GIF, a WebM video or
 * a PNG sprite sheet. Frames are rendered exactly (the engine is a function of time) by an
 * off-screen ClawdButton at 1:1 pixels and composited to one canvas.
 *
 * GIF: gifenc. WebM: the browser's VP9 encoder (WebCodecs) and the small WebM writer below.
 */

import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { ANIMATIONS } from '../engine/animations'
import type { AnimId } from '../engine/types'
import { ensureFont } from './fonts'
import { ClawdButton, injectButtonCss } from './renderer'
import type { Settings } from './settings'

export type ExportFormat = 'gif' | 'webm' | 'sheet'

export interface ExportOptions {
  anim: AnimId
  /** width in px (height follows the button's shape) */
  width: number
  fps: number
  /** just the looping part, so it repeats seamlessly (otherwise one play from the start) */
  loop: boolean
}

/** 0–1, called as frames are rendered and encoded */
export type Progress = (done: number) => void

export const canExportWebm = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'

/** The play-clock times to render. */
function times(o: ExportOptions): number[] {
  const a = ANIMATIONS[o.anim]
  const start = o.loop ? a.duration : 0
  const len = o.loop ? a.duration - a.loopFrom : a.duration
  const n = Math.max(1, Math.round(len * o.fps))
  return Array.from({ length: n }, (_, i) => start + i / o.fps)
}

/** Render each frame into one canvas and hand it over (awaited, one at a time). */
async function renderFrames(settings: Settings, o: ExportOptions, each: (c: HTMLCanvasElement, i: number, n: number) => void | Promise<void>) {
  await ensureFont(settings.font)
  await ensureFont('press')
  injectButtonCss()
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none'
  document.body.appendChild(host)
  const b = new ClawdButton(host, { ...settings, size: o.width }, { dpr: 1 })
  try {
    const { width, height } = b.pixelSize
    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const ctx = out.getContext('2d', { willReadFrequently: true })!
    const ts = times(o)
    for (let i = 0; i < ts.length; i++) {
      b.renderAt(ts[i], o.anim)
      b.composite(ctx)
      await each(out, i, ts.length)
    }
  } finally {
    b.destroy()
    host.remove()
  }
}

/** yield to the page now and then so a progress bar can update */
const breathe = () => new Promise((r) => setTimeout(r, 0))

export async function exportGif(settings: Settings, o: ExportOptions, progress?: Progress): Promise<Blob> {
  const gif = GIFEncoder()
  await renderFrames(settings, o, async (c, i, n) => {
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
    // rounded corners are see-through: one palette entry is transparent
    const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true })
    const index = applyPalette(data, palette, 'rgba4444')
    const clear = palette.findIndex((p) => p[3] === 0)
    gif.writeFrame(index, c.width, c.height, { palette, delay: 1000 / o.fps, transparent: clear >= 0, transparentIndex: Math.max(0, clear), repeat: 0 })
    progress?.((i + 1) / n)
    if (i % 8 === 7) await breathe()
  })
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

export async function exportSheet(settings: Settings, o: ExportOptions, progress?: Progress): Promise<{ blob: Blob; cols: number; frames: number }> {
  let sheet: HTMLCanvasElement | null = null
  let cols = 1
  let frames = 0
  await renderFrames(settings, o, async (c, i, n) => {
    if (!sheet) {
      frames = n
      cols = Math.min(n, 10)
      sheet = document.createElement('canvas')
      sheet.width = c.width * cols
      sheet.height = c.height * Math.ceil(n / cols)
    }
    sheet.getContext('2d')!.drawImage(c, (i % cols) * c.width, Math.floor(i / cols) * c.height)
    progress?.((i + 1) / n)
    if (i % 16 === 15) await breathe()
  })
  const blob = await new Promise<Blob>((ok, fail) => sheet!.toBlob((b) => (b ? ok(b) : fail(new Error('could not make the PNG'))), 'image/png'))
  return { blob, cols, frames }
}

export async function exportWebm(settings: Settings, o: ExportOptions, progress?: Progress): Promise<Blob> {
  if (!canExportWebm()) throw new Error('This browser has no video encoder (WebCodecs).')
  const chunks: { data: Uint8Array; ms: number; key: boolean }[] = []
  let failed: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength)
      chunk.copyTo(data)
      chunks.push({ data, ms: Math.round(chunk.timestamp / 1000), key: chunk.type === 'key' })
    },
    error: (e) => (failed = e instanceof Error ? e : new Error(String(e))),
  })
  let size = { width: 0, height: 0 }
  await renderFrames(settings, o, async (c, i, n) => {
    if (i === 0) {
      // VP9 wants even sizes: the frame is cropped by at most a pixel
      size = { width: c.width & ~1, height: c.height & ~1 }
      const config: VideoEncoderConfig = { codec: 'vp09.00.10.08', ...size, bitrate: 4_000_000, framerate: o.fps }
      const ok = await VideoEncoder.isConfigSupported(config)
      if (!ok.supported) throw new Error('This browser can’t encode VP9 video.')
      encoder.configure(config)
    }
    const frame = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / o.fps), duration: Math.round(1e6 / o.fps), visibleRect: { x: 0, y: 0, ...size } })
    encoder.encode(frame, { keyFrame: i % (o.fps * 2) === 0 })
    frame.close()
    progress?.(((i + 1) / n) * 0.95)
    // don't let the encoder queue grow without bound
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5))
  })
  await encoder.flush()
  encoder.close()
  if (failed) throw failed
  progress?.(1)
  const durationMs = (times(o).length * 1000) / o.fps
  return new Blob([webm(size.width, size.height, durationMs, chunks)], { type: 'video/webm' })
}

// ───────────────────────── a minimal WebM writer ─────────────────────────
// EBML header, then a Segment with Info, one VP9 video track, and a Cluster per keyframe
// holding SimpleBlocks (timestamps in ms, relative to their cluster).

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
/** element size as an EBML variable-length integer (8 bytes: always big enough) */
const vsize = (n: number) => {
  const b = new Uint8Array(8)
  b[0] = 0x01
  for (let i = 7, v = n; i >= 1; i--, v = Math.floor(v / 256)) b[i] = v % 256
  return b
}
const idBytes = (id: number) => {
  const b: number[] = []
  for (let v = id; v > 0; v = Math.floor(v / 256)) b.unshift(v % 256)
  return new Uint8Array(b)
}
const el = (id: number, ...body: Uint8Array[]) => {
  const payload = concat(body)
  return concat([idBytes(id), vsize(payload.length), payload])
}
const uint = (id: number, n: number) => {
  const b: number[] = []
  for (let v = n; v > 0 || b.length === 0; v = Math.floor(v / 256)) b.unshift(v % 256)
  return el(id, new Uint8Array(b))
}
const str = (id: number, s: string) => el(id, new TextEncoder().encode(s))
const float = (id: number, n: number) => {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setFloat64(0, n)
  return el(id, b)
}

function webm(width: number, height: number, durationMs: number, chunks: { data: Uint8Array; ms: number; key: boolean }[]): Uint8Array<ArrayBuffer> {
  const header = el(0x1a45dfa3, uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8), str(0x4282, 'webm'), uint(0x4287, 2), uint(0x4285, 2))
  const info = el(0x1549a966, uint(0x2ad7b1, 1_000_000), float(0x4489, durationMs), str(0x4d80, 'Clawd Widget'), str(0x5741, 'Clawd Widget'))
  const track = el(
    0xae,
    uint(0xd7, 1),
    uint(0x73c5, 1),
    uint(0x83, 1),
    str(0x86, 'V_VP9'),
    uint(0x23e383, Math.round(durationMs * 1e6 / Math.max(1, chunks.length))),
    el(0xe0, uint(0xb0, width), uint(0xba, height)),
  )
  const tracks = el(0x1654ae6b, track)
  const clusters: Uint8Array[] = []
  let start = 0
  let blocks: Uint8Array[] = []
  const close = () => {
    if (blocks.length) clusters.push(el(0x1f43b675, uint(0xe7, start), ...blocks))
    blocks = []
  }
  for (const c of chunks) {
    if (c.key || c.ms - start > 30000) {
      close()
      start = c.ms
    }
    const rel = c.ms - start
    // track 1, 16-bit relative timestamp, flags (0x80 = keyframe), then the frame
    const head = new Uint8Array([0x81, (rel >> 8) & 0xff, rel & 0xff, c.key ? 0x80 : 0x00])
    blocks.push(el(0xa3, head, c.data))
  }
  close()
  return concat([header, el(0x18538067, info, tracks, ...clusters)])
}
