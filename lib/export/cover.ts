import { PLAY_H, PLAY_W } from "../compose/layout.ts"

export interface CoverRect {
  dx: number
  dy: number
  dw: number
  dh: number
}

/** Center-offset framing: x/y 0 = video center on canvas center. */
export type Framing = {
  scale: number
  x: number
  y: number
}

export type CoverTransform = Partial<Framing>

export const FRAMING_SCALE_MIN = 1
export const FRAMING_SCALE_MAX = 4
export const DEFAULT_FRAMING: Framing = { scale: 1, x: 0, y: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function framingOrDefault(transform?: CoverTransform | null): Framing {
  return {
    scale: Math.max(FRAMING_SCALE_MIN, transform?.scale ?? 1),
    x: transform?.x ?? 0,
    y: transform?.y ?? 0,
  }
}

export function getVideoRect(
  framing: CoverTransform | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
): CoverRect {
  if (!(sourceWidth > 0 && sourceHeight > 0 && destWidth > 0 && destHeight > 0)) {
    return { dx: 0, dy: 0, dw: destWidth, dh: destHeight }
  }
  const { scale, x, y } = framingOrDefault(framing)
  const cover = Math.max(destWidth / sourceWidth, destHeight / sourceHeight)
  const dw = sourceWidth * cover * scale
  const dh = sourceHeight * cover * scale
  const centerX = destWidth / 2 + (x / 100) * destWidth
  const centerY = destHeight / 2 + (y / 100) * destHeight
  let dx = centerX - dw / 2
  let dy = centerY - dh / 2
  if (dw >= destWidth) dx = clamp(dx, destWidth - dw, 0)
  else dx = (destWidth - dw) / 2
  if (dh >= destHeight) dy = clamp(dy, destHeight - dh, 0)
  else dy = (destHeight - dh) / 2
  return { dx, dy, dw, dh }
}

export function evenRenderRect(
  framing: CoverTransform | null | undefined,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
): CoverRect {
  const preview = getVideoRect(framing, sourceWidth, sourceHeight, destWidth, destHeight)
  const w = Math.round(preview.dw / 2) * 2
  const h = Math.round(preview.dh / 2) * 2
  const { x, y } = framingOrDefault(framing)
  let ox = Math.round(destWidth / 2 + (x / 100) * destWidth - w / 2)
  let oy = Math.round(destHeight / 2 + (y / 100) * destHeight - h / 2)
  if (w >= destWidth) ox = clamp(ox, destWidth - w, 0)
  else ox = Math.round((destWidth - w) / 2)
  if (h >= destHeight) oy = clamp(oy, destHeight - h, 0)
  else oy = Math.round((destHeight - h) / 2)
  return { dx: ox, dy: oy, dw: w, dh: h }
}

export function coverDrawRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
  transform?: CoverTransform | null,
): CoverRect {
  return getVideoRect(transform, sourceWidth, sourceHeight, destWidth, destHeight)
}

export function transformFromCoverRect(
  rect: CoverRect,
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
): Framing {
  if (!(sourceWidth > 0 && sourceHeight > 0 && rect.dw > 0 && rect.dh > 0)) {
    return { ...DEFAULT_FRAMING }
  }
  const cover = Math.max(destWidth / sourceWidth, destHeight / sourceHeight)
  const rawScale = cover > 0 ? rect.dw / sourceWidth / cover : 1
  const scale = Math.round(clamp(rawScale, FRAMING_SCALE_MIN, FRAMING_SCALE_MAX) * 1000) / 1000
  const centerX = rect.dx + rect.dw / 2
  const centerY = rect.dy + rect.dh / 2
  const x = Math.round(((centerX - destWidth / 2) / destWidth) * 100 * 1000) / 1000
  const y = Math.round(((centerY - destHeight / 2) / destHeight) * 100 * 1000) / 1000
  return { scale, x, y }
}

export function overlayDrawScale(outputHeight: number, designHeight: number): number {
  if (!(designHeight > 0)) return 1
  return outputHeight / designHeight
}
