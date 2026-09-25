// Package entry for <clawd-button> (npm: packages/clawd-button). Importing it registers the element.
import { defineClawdButton } from './clawd-button'

export { ClawdButtonElement, defineClawdButton } from './clawd-button'
export type { Status as ClawdStatus } from '../core/renderer'
export type { AnimId as ClawdAnimation } from '../engine/types'

defineClawdButton()
