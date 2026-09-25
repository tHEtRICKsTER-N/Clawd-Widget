/** Deterministic hash → [0,1). */
export function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/** Deterministic value in [-1,1] from any number of integer keys. */
export const jitter = (...k: number[]) => hash(k.reduce((a, b) => Math.imul(a, 31) + (b | 0), 17)) * 2 - 1
