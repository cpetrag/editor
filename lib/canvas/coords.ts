import { PLAY_H, PLAY_W, percentsFromCenter } from "../compose/layout.ts"

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function playToPercent(playX: number, playY: number): { x: number; y: number } {
  return percentsFromCenter(playX, playY)
}

export function percentToPlay(x: number, y: number): { playX: number; playY: number } {
  return {
    playX: (clamp(x, 0, 100) / 100) * PLAY_W,
    playY: (clamp(y, 0, 100) / 100) * PLAY_H,
  }
}

export function framePxToPercentDelta(dxPx: number, dyPx: number): { x: number; y: number } {
  return {
    x: (dxPx / PLAY_W) * 100,
    y: (dyPx / PLAY_H) * 100,
  }
}

export function nudgeTextPercents(
  current: { x: number; y: number },
  key: string,
  shift: boolean,
): { x: number; y: number } {
  const step = shift ? 10 : 1
  const delta = framePxToPercentDelta(step, step)
  let { x, y } = current
  if (key === "ArrowLeft") x -= delta.x
  else if (key === "ArrowRight") x += delta.x
  else if (key === "ArrowUp") y -= delta.y
  else if (key === "ArrowDown") y += delta.y
  else return current
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  }
}
