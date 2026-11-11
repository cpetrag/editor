import type { Animation } from "../style/types.ts"

export const MOTION_FPS = 30
export const PHASE_MIN_SECONDS = 0.1
export const PHASE_MAX_SECONDS = 2

export function secondsToFrames(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0
  return Math.max(0, Math.round(seconds * MOTION_FPS))
}

export function framesToSeconds(frames: number): number {
  return Math.round((Math.max(0, frames) / MOTION_FPS) * 100) / 100
}

export function formatMotionClock(frames: number): string {
  const seconds = framesToSeconds(frames).toFixed(2).replace(".", ",")
  return `${seconds} s · ${Math.round(Math.max(0, frames))} f`
}

export function formatMotionSeconds(seconds: number): string {
  return (Math.round(seconds * 10) / 10).toFixed(1).replace(".", ",")
}

/** Quadros extras até a última palavra ou letra terminar de entrar. */
export function staggerSpanFrames(staggerFrames: number, unitCount: number): number {
  return Math.max(0, staggerFrames) * Math.max(0, Math.round(unitCount) - 1)
}

export function enterTotalFrames(input: {
  enterFrames: number
  delayFrames: number
  staggerFrames: number
  unitCount: number
}): number {
  return Math.max(0, input.delayFrames) + Math.max(0, input.enterFrames) + staggerSpanFrames(input.staggerFrames, input.unitCount)
}

/**
 * Teto de cada fase para entrada + atraso + intervalo + saída caberem no insert.
 * O slider de 0,1–2,0 s nunca passa desse teto.
 */
export function motionPhaseLimits(input: {
  insertSeconds: number
  enterFrames: number
  delayFrames: number
  staggerFrames: number
  exitFrames: number
  unitCount: number
}): { enterMax: number; exitMax: number; staggerMax: number; tight: boolean } {
  const total = Math.max(0, secondsToFrames(input.insertSeconds))
  const delay = Math.max(0, input.delayFrames)
  const staggerSpan = staggerSpanFrames(input.staggerFrames, input.unitCount)
  const enter = Math.max(0, input.enterFrames)
  const exit = Math.max(0, input.exitFrames)
  const enterMax = Math.max(0, total - delay - staggerSpan - exit)
  const exitMax = Math.max(0, total - delay - staggerSpan - enter)
  const slots = Math.max(0, Math.round(input.unitCount) - 1)
  const staggerRoom = total - delay - enter - exit
  const staggerMax = slots > 0 ? Math.max(0, Math.floor(staggerRoom / slots)) : 0
  const ceiling = secondsToFrames(PHASE_MAX_SECONDS)
  return {
    enterMax,
    exitMax,
    staggerMax,
    tight: enterMax < ceiling || exitMax < ceiling,
  }
}

export function clampPhaseFrames(frames: number, maxFrames: number): number {
  const min = Math.min(secondsToFrames(PHASE_MIN_SECONDS), Math.max(0, maxFrames))
  const cap = Math.min(secondsToFrames(PHASE_MAX_SECONDS), Math.max(0, maxFrames))
  return Math.max(min, Math.min(cap, Math.round(frames)))
}

export function hasCustomTiming(current: Animation, defaults: Animation): boolean {
  return (
    current.enter.durationInFrames !== defaults.enter.durationInFrames ||
    current.enter.delayInFrames !== defaults.enter.delayInFrames ||
    current.enter.staggerInFrames !== defaults.enter.staggerInFrames ||
    current.exit.durationInFrames !== defaults.exit.durationInFrames ||
    (current.speed ?? 1) !== (defaults.speed ?? 1) ||
    current.loop.speed !== defaults.loop.speed ||
    current.loop.amplitude !== defaults.loop.amplitude
  )
}

export function motionHasExit(animation: Animation): boolean {
  return animation.exit.durationInFrames > 0 || Object.keys(animation.exit.to).length > 0
}

export function motionHasLoop(animation: Animation): boolean {
  return animation.loop.type !== "nenhum" && animation.loop.amplitude !== 0
}
