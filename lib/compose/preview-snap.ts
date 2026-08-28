import { PLAY_H, PLAY_W, percentsFromCenter } from "./layout.ts"
import type { PlayBox } from "./hit-test.ts"

export type NudgeKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function nearestGuide(value: number, guides: number[], tolerance: number): number {
  let best = value
  let bestDist = tolerance
  for (const guide of guides) {
    const dist = Math.abs(value - guide)
    if (dist <= bestDist) {
      best = guide
      bestDist = dist
    }
  }
  return best
}

export function snapMoveCenter(
  cx: number,
  cy: number,
  others: readonly PlayBox[],
  tolerance: number,
): { cx: number; cy: number } {
  if (!(tolerance > 0)) return { cx, cy }

  const xGuides = [0, PLAY_W / 2, PLAY_W]
  const yGuides = [0, PLAY_H / 2, PLAY_H]
  for (const box of others) {
    xGuides.push(box.cx, box.cx - box.w / 2, box.cx + box.w / 2)
    yGuides.push(box.cy, box.cy - box.h / 2, box.cy + box.h / 2)
  }

  return {
    cx: nearestGuide(cx, xGuides, tolerance),
    cy: nearestGuide(cy, yGuides, tolerance),
  }
}

export function nudgePercents(
  current: { x: number; y: number },
  key: string,
  shift: boolean,
): { x: number; y: number } {
  const step = shift ? 5 : 1
  let { x, y } = current
  if (key === "ArrowLeft") x -= step
  else if (key === "ArrowRight") x += step
  else if (key === "ArrowUp") y -= step
  else if (key === "ArrowDown") y += step
  else return current
  return {
    x: clamp(Math.round(x * 10) / 10, 0, 100),
    y: clamp(Math.round(y * 10) / 10, 0, 100),
  }
}

export function patchForMove(cx: number, cy: number): { x: number; y: number } {
  return percentsFromCenter(cx, cy)
}
