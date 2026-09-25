// The parts of gifenc (https://github.com/mattdesl/gifenc) that export.ts uses; the package ships no types.
declare module 'gifenc' {
  export type Palette = number[][]
  export type Format = 'rgb565' | 'rgb444' | 'rgba4444'
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: Format; oneBitAlpha?: boolean | number }): Palette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: Format): Uint8Array
  export interface Encoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; transparent?: boolean; transparentIndex?: number; repeat?: number },
    ): void
    finish(): void
    bytes(): Uint8Array<ArrayBuffer>
  }
  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): Encoder
}
