import {
  DEFAULT_FRAMING,
  FRAMING_SCALE_MAX,
  FRAMING_SCALE_MIN,
  coverDrawRect,
  evenRenderRect,
  getVideoRect,
  transformFromCoverRect,
  type CoverRect,
  type Framing,
} from "./export/cover.ts"
import { PLAY_H, PLAY_W } from "./compose/layout.ts"

export type SourceTransform = Framing
export type { Framing }

export const SOURCE_SCALE_MIN = FRAMING_SCALE_MIN
export const SOURCE_SCALE_MAX = FRAMING_SCALE_MAX
export const DEFAULT_SOURCE_TRANSFORM: SourceTransform = { ...DEFAULT_FRAMING }
export const FRAMING_CENTER_SNAP = 0.6

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function asFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function clampScale(value: number): number {
  return Math.round(clamp(value, SOURCE_SCALE_MIN, SOURCE_SCALE_MAX) * 1000) / 1000
}

function roundOffset(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function isIdentitySourceTransform(transform: SourceTransform): boolean {
  return transform.scale === 1 && transform.x === 0 && transform.y === 0
}

export function sourceTransformOrDefault(
  transform: SourceTransform | undefined,
): SourceTransform {
  return transform ?? DEFAULT_SOURCE_TRANSFORM
}

function framingFromAnchor(
  scale: number,
  anchorX: number,
  anchorY: number,
  sourceWidth: number,
  sourceHeight: number,
): SourceTransform {
  const zoom = Math.max(SOURCE_SCALE_MIN, scale)
  if (!(sourceWidth > 0 && sourceHeight > 0)) {
    return { scale: clampScale(zoom), x: 0, y: 0 }
  }
  const cover = Math.max(PLAY_W / sourceWidth, PLAY_H / sourceHeight)
  const dw = sourceWidth * cover * zoom
  const dh = sourceHeight * cover * zoom
  const dx = PLAY_W / 2 - (anchorX / 100) * dw
  const dy = PLAY_H / 2 - (anchorY / 100) * dh
  return clampSourceTransform(
    {
      scale: zoom,
      x: ((dx + dw / 2 - PLAY_W / 2) / PLAY_W) * 100,
      y: ((dy + dh / 2 - PLAY_H / 2) / PLAY_H) * 100,
    },
    sourceWidth,
    sourceHeight,
  )
}

export function parseSourceTransform(
  raw: unknown,
  sourceWidth = 0,
  sourceHeight = 0,
): SourceTransform | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const scale = asFinite(record.scale)
  const x = asFinite(record.x)
  const y = asFinite(record.y)
  if (scale === undefined && x === undefined && y === undefined) return undefined
  const offsetSpace = record.space === "offset"
  const next = offsetSpace
    ? {
        scale: clampScale(scale ?? 1),
        x: roundOffset(x ?? 0),
        y: roundOffset(y ?? 0),
      }
    : framingFromAnchor(scale ?? 1, x ?? 50, y ?? 50, sourceWidth, sourceHeight)
  const clamped =
    sourceWidth > 0 && sourceHeight > 0
      ? clampSourceTransform(next, sourceWidth, sourceHeight)
      : next
  return isIdentitySourceTransform(clamped) ? undefined : clamped
}

export function serializeSourceTransform(
  transform: SourceTransform,
): SourceTransform & { space: "offset" } {
  return { ...transform, space: "offset" }
}

export function clampSourceTransform(
  transform: SourceTransform,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
): SourceTransform {
  const rounded: SourceTransform = {
    scale: clampScale(transform.scale),
    x: roundOffset(transform.x),
    y: roundOffset(transform.y),
  }
  if (!(sourceWidth > 0 && sourceHeight > 0)) return rounded
  const rect = getVideoRect(rounded, sourceWidth, sourceHeight, destWidth, destHeight)
  return transformFromCoverRect(rect, sourceWidth, sourceHeight, destWidth, destHeight)
}

export function snapFramingToCenter(
  transform: SourceTransform,
  disableSnap: boolean,
): SourceTransform {
  if (disableSnap) return transform
  return {
    ...transform,
    x: Math.abs(transform.x) < FRAMING_CENTER_SNAP ? 0 : transform.x,
    y: Math.abs(transform.y) < FRAMING_CENTER_SNAP ? 0 : transform.y,
  }
}

export function panSourceTransform(
  current: SourceTransform,
  deltaPlayX: number,
  deltaPlayY: number,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
  options: { altKey?: boolean } = {},
): SourceTransform {
  const base = clampSourceTransform(current, sourceWidth, sourceHeight, destWidth, destHeight)
  const next = {
    scale: base.scale,
    x: base.x + (deltaPlayX / destWidth) * 100,
    y: base.y + (deltaPlayY / destHeight) * 100,
  }
  return snapFramingToCenter(
    clampSourceTransform(next, sourceWidth, sourceHeight, destWidth, destHeight),
    Boolean(options.altKey),
  )
}

export function scaleSourceTransformAt(
  current: SourceTransform,
  factor: number,
  pivot: { x: number; y: number },
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
  options: { altKey?: boolean } = {},
): SourceTransform {
  const base = clampSourceTransform(current, sourceWidth, sourceHeight, destWidth, destHeight)
  const s1 = Math.max(SOURCE_SCALE_MIN, base.scale)
  const s2 = clampScale(s1 * factor)
  const ratio = s1 > 0 ? s2 / s1 : 1
  const rect = getVideoRect(base, sourceWidth, sourceHeight, destWidth, destHeight)
  const centerX = rect.dx + rect.dw / 2
  const centerY = rect.dy + rect.dh / 2
  const center2x = pivot.x + (centerX - pivot.x) * ratio
  const center2y = pivot.y + (centerY - pivot.y) * ratio
  const next: SourceTransform = {
    scale: s2,
    x: ((center2x - destWidth / 2) / destWidth) * 100,
    y: ((center2y - destHeight / 2) / destHeight) * 100,
  }
  return snapFramingToCenter(
    clampSourceTransform(next, sourceWidth, sourceHeight, destWidth, destHeight),
    Boolean(options.altKey),
  )
}

export function scaleSourceTransform(
  current: SourceTransform,
  factor: number,
  sourceWidth: number,
  sourceHeight: number,
  destWidth = PLAY_W,
  destHeight = PLAY_H,
): SourceTransform {
  return scaleSourceTransformAt(
    current,
    factor,
    { x: destWidth / 2, y: destHeight / 2 },
    sourceWidth,
    sourceHeight,
    destWidth,
    destHeight,
  )
}

export const SOURCE_ZOOM_PERCENT_MIN = Math.round(SOURCE_SCALE_MIN * 100)
export const SOURCE_ZOOM_PERCENT_MAX = Math.round(SOURCE_SCALE_MAX * 100)

export function sourceZoomPercent(transform: SourceTransform | undefined): number {
  return Math.round(sourceTransformOrDefault(transform).scale * 100)
}

export function parseZoomPercent(raw: string): number | null {
  const value = Number.parseFloat(raw.replace("%", "").trim())
  if (!Number.isFinite(value)) return null
  return Math.round(clamp(value, SOURCE_ZOOM_PERCENT_MIN, SOURCE_ZOOM_PERCENT_MAX))
}

export function zoomSourceTransformTo(
  current: SourceTransform | undefined,
  percent: number,
  sourceWidth: number,
  sourceHeight: number,
): SourceTransform {
  const base = sourceTransformOrDefault(current)
  const target = clamp(percent, SOURCE_ZOOM_PERCENT_MIN, SOURCE_ZOOM_PERCENT_MAX) / 100
  return scaleSourceTransform(base, target / base.scale, sourceWidth, sourceHeight)
}

export function nudgeSourceTransform(
  current: SourceTransform,
  key: string,
  shift: boolean,
  sourceWidth: number,
  sourceHeight: number,
): SourceTransform {
  const pixels = shift ? 10 : 1
  let { scale, x, y } = sourceTransformOrDefault(current)
  if (key === "ArrowRight") x += (pixels / PLAY_W) * 100
  else if (key === "ArrowLeft") x -= (pixels / PLAY_W) * 100
  else if (key === "ArrowDown") y += (pixels / PLAY_H) * 100
  else if (key === "ArrowUp") y -= (pixels / PLAY_H) * 100
  else return current
  return clampSourceTransform({ scale, x, y }, sourceWidth, sourceHeight)
}

export function framingOffsetBounds(
  scale: number,
  sourceWidth: number,
  sourceHeight: number,
): { maxX: number; maxY: number } {
  const rect = getVideoRect({ scale, x: 0, y: 0 }, sourceWidth, sourceHeight)
  return {
    maxX: Math.max(0, roundOffset(((rect.dw - PLAY_W) / 2 / PLAY_W) * 100)),
    maxY: Math.max(0, roundOffset(((rect.dh - PLAY_H) / 2 / PLAY_H) * 100)),
  }
}

export function sourceScaleRangeLabel(): string {
  return "Escala 1–4"
}

export { evenRenderRect, getVideoRect }
export type { CoverRect }
