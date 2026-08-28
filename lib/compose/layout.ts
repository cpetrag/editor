export const PLAY_W = 1080
export const PLAY_H = 1920
export const SNAP_SCREEN_PX = 8

export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

export interface CanvasDisplayMetrics {
  displayScale: number
  dispW: number
  dispH: number
  ox: number
  oy: number
}

export type ClientPlayHit =
  | { inside: false }
  | { inside: true; playX: number; playY: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getCanvasDisplayMetrics(rect: RectLike): CanvasDisplayMetrics {
  const displayScale =
    rect.width <= 0 || rect.height <= 0
      ? 0
      : Math.min(rect.width / PLAY_W, rect.height / PLAY_H)
  const dispW = PLAY_W * displayScale
  const dispH = PLAY_H * displayScale
  return {
    displayScale,
    dispW,
    dispH,
    ox: rect.left + (rect.width - dispW) / 2,
    oy: rect.top + (rect.height - dispH) / 2,
  }
}

export function clientToPlay(
  clientX: number,
  clientY: number,
  metrics: CanvasDisplayMetrics,
): ClientPlayHit {
  if (!(metrics.displayScale > 0)) return { inside: false }
  const localX = clientX - metrics.ox
  const localY = clientY - metrics.oy
  if (localX < 0 || localY < 0 || localX > metrics.dispW || localY > metrics.dispH) {
    return { inside: false }
  }
  return {
    inside: true,
    playX: clamp(localX / metrics.displayScale, 0, PLAY_W),
    playY: clamp(localY / metrics.displayScale, 0, PLAY_H),
  }
}

export function playToClient(
  playX: number,
  playY: number,
  metrics: CanvasDisplayMetrics,
): { x: number; y: number } {
  return {
    x: metrics.ox + playX * metrics.displayScale,
    y: metrics.oy + playY * metrics.displayScale,
  }
}

export function percentsFromCenter(
  cx: number,
  cy: number,
): { x: number; y: number } {
  return {
    x: clamp(Math.round((cx / PLAY_W) * 1000) / 10, 0, 100),
    y: clamp(Math.round((cy / PLAY_H) * 1000) / 10, 0, 100),
  }
}

export function playBoxToCss(
  box: { cx: number; cy: number; w: number; h: number },
  metrics: CanvasDisplayMetrics,
  host: RectLike,
): { left: number; top: number; width: number; height: number } {
  const leftTop = playToClient(box.cx - box.w / 2, box.cy - box.h / 2, metrics)
  return {
    left: leftTop.x - host.left,
    top: leftTop.y - host.top,
    width: box.w * metrics.displayScale,
    height: box.h * metrics.displayScale,
  }
}
