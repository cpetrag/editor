import { PLAY_H, PLAY_W } from "../compose/layout.ts"
import type { PlayBox } from "../compose/hit-test.ts"

export const SAFE_INSET_RATIO = 0.06

export type SnapGuides = {
  x: number | null
  y: number | null
}

function nearestGuide(value: number, guides: number[], tolerance: number): { value: number; guide: number | null } {
  let best = value
  let bestDist = tolerance
  let guide: number | null = null
  for (const candidate of guides) {
    const dist = Math.abs(value - candidate)
    if (dist <= bestDist) {
      best = candidate
      bestDist = dist
      guide = candidate
    }
  }
  return { value: best, guide }
}

export function snapMoveWithGuides(
  cx: number,
  cy: number,
  others: readonly PlayBox[],
  tolerance: number,
): { cx: number; cy: number; guides: SnapGuides } {
  if (!(tolerance > 0)) return { cx, cy, guides: { x: null, y: null } }

  const xGuides = [0, PLAY_W * SAFE_INSET_RATIO, PLAY_W / 2, PLAY_W * (1 - SAFE_INSET_RATIO), PLAY_W]
  const yGuides = [0, PLAY_H * SAFE_INSET_RATIO, PLAY_H / 2, PLAY_H * (1 - SAFE_INSET_RATIO), PLAY_H]
  for (const box of others) {
    xGuides.push(box.cx, box.cx - box.w / 2, box.cx + box.w / 2)
    yGuides.push(box.cy, box.cy - box.h / 2, box.cy + box.h / 2)
  }

  const x = nearestGuide(cx, xGuides, tolerance)
  const y = nearestGuide(cy, yGuides, tolerance)
  return {
    cx: x.value,
    cy: y.value,
    guides: { x: x.guide, y: y.guide },
  }
}
