import { clampInsert, MIN_DURATION, type CompositionInsert } from "./composition.ts"

const HANDLE_PX = 8

export type TimelineHandle = "in" | "out" | "move"

export interface TimingSpan {
  start: number
  duration: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundTenths(value: number): number {
  return Math.round(value * 10) / 10
}

export function clientXToTime(
  clientX: number,
  rect: { left: number; width: number },
  totalDuration: number,
): number {
  if (!(rect.width > 0) || !(totalDuration > 0)) return 0
  const ratio = (clientX - rect.left) / rect.width
  return clamp(roundTenths(ratio * totalDuration), 0, totalDuration)
}

/**
 * Quadro alvo ao andar `frames` a partir de `time`. Parte do quadro mais próximo
 * para que cliques fora da grade (timeline arredonda em décimos) não pulem dois quadros.
 */
export function stepFrameIndex(
  time: number,
  frames: number,
  fps: number,
  totalDuration: number,
): number {
  if (!(fps > 0) || !(totalDuration > 0)) return 0
  const lastFrame = Math.max(0, Math.floor(totalDuration * fps) - 1)
  return clamp(Math.round(time * fps) + frames, 0, lastFrame)
}

/** `m:ss:ff`, com o quadro dentro do segundo (base `fps`). */
export function formatTimecode(seconds: number, fps: number): string {
  const safeFps = fps > 0 ? Math.round(fps) : 30
  const totalFrames = Math.max(0, Math.round(seconds * safeFps))
  const frame = totalFrames % safeFps
  const wholeSeconds = Math.floor(totalFrames / safeFps)
  const minutes = Math.floor(wholeSeconds / 60)
  const secs = wholeSeconds % 60
  return `${minutes}:${secs.toString().padStart(2, "0")}:${frame.toString().padStart(2, "0")}`
}

function applyTiming(
  next: TimingSpan,
  videoDuration: number,
  field: "start" | "duration",
): TimingSpan {
  const clamped = clampInsert(
    { start: next.start, duration: next.duration } as CompositionInsert,
    videoDuration,
    field,
  )
  return { start: clamped.start, duration: clamped.duration }
}

export function moveInsertTiming(
  current: TimingSpan,
  nextStart: number,
  videoDuration: number,
): TimingSpan {
  return applyTiming(
    { start: nextStart, duration: current.duration },
    videoDuration,
    "start",
  )
}

export function trimInsertIn(
  current: TimingSpan,
  time: number,
  videoDuration: number,
): TimingSpan {
  const end = current.start + current.duration
  const maxStart = Math.max(0, end - MIN_DURATION)
  const start = clamp(roundTenths(time), 0, maxStart)
  return applyTiming({ start, duration: end - start }, videoDuration, "duration")
}

export function trimInsertOut(
  current: TimingSpan,
  time: number,
  videoDuration: number,
): TimingSpan {
  const minEnd = current.start + MIN_DURATION
  const maxEnd = videoDuration > 0 ? videoDuration : minEnd
  const end = clamp(roundTenths(time), minEnd, maxEnd)
  return applyTiming(
    { start: current.start, duration: end - current.start },
    videoDuration,
    "duration",
  )
}

export function hitTimelineHandle(localX: number, widthPx: number): TimelineHandle {
  if (!(widthPx > 0)) return "move"
  const band = Math.min(HANDLE_PX, widthPx / 3)
  if (localX <= band) return "in"
  if (localX >= widthPx - band) return "out"
  return "move"
}
