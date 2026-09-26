// Types for the clawd-button package (the element itself is src/wc/clawd-button.ts in the repo).

export type ClawdAnimation =
  | 'guitar'
  | 'hello'
  | 'jump'
  | 'code'
  | 'dance'
  | 'sleep'
  | 'think'
  | 'ship'
  | 'squash'
  | 'levelup'
  | 'spooky'
  | 'snow'
  | 'konami'

/** working: loops Thinking · waiting: waves, then "!" · done: Jump Party · idle: rests */
export type ClawdStatus = 'working' | 'waiting' | 'done' | 'idle'

export interface ClawdEventDetail {
  /** the animation that started or ended */
  anim: ClawdAnimation | null
}

export declare class ClawdButtonElement extends HTMLElement {
  static observedAttributes: string[]
  /** Play an animation (default: the `anim` attribute). */
  play(anim?: ClawdAnimation | 'random'): void
  /** Back to resting. */
  stop(): void
  setStatus(state: ClawdStatus): void
  /** The renderer underneath, for experiments (not a stable API). */
  readonly button: unknown
}

/** Register the element under another tag name (importing the package already registers `clawd-button`). */
export declare function defineClawdButton(tag?: string): void

declare global {
  interface HTMLElementTagNameMap {
    'clawd-button': ClawdButtonElement
  }
  interface HTMLElementEventMap {
    'clawd-play': CustomEvent<ClawdEventDetail>
    'clawd-end': CustomEvent<ClawdEventDetail>
  }
}
