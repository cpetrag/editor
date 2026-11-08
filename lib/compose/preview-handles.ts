import type { Point } from "./hit-test.ts"

export function angleDegFromCenter(center: Point, pointer: Point): number {
  return (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI
}

function unwrapDelta(fromDeg: number, toDeg: number): number {
  let delta = toDeg - fromDeg
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

export function rotationFromDrag(
  startRotation: number,
  startPointerDeg: number,
  nowPointerDeg: number,
): number {
  return startRotation + unwrapDelta(startPointerDeg, nowPointerDeg)
}

export function localPoint(center: Point, pointer: Point, rotationDeg: number): Point {
  const dx = pointer.x - center.x
  const dy = pointer.y - center.y
  const rad = (-rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

export const CORNER_SCALE_MIN = 0.3
export const CORNER_SCALE_MAX = 4

/** scale = scale0 × (distância atual ao centro / distância inicial), entre 0,3 e 4. */
export function scaleFromCornerDrag(scale0: number, startDist: number, nowDist: number): number {
  const base = scale0 > 0 ? scale0 : 1
  if (!(startDist > 0) || !(nowDist > 0)) return base
  const next = base * (nowDist / startDist)
  const clamped = Math.min(CORNER_SCALE_MAX, Math.max(CORNER_SCALE_MIN, next))
  return Math.round(clamped * 1000) / 1000
}

export function maxWidthPctFromEdgeDrag(
  startWidthPct: number,
  localDxPx: number,
  playW: number,
  edge: "e" | "w",
): number {
  const signed = edge === "e" ? localDxPx : -localDxPx
  const next = startWidthPct + ((2 * signed) / playW) * 100
  return Math.min(100, Math.max(20, next))
}
