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
