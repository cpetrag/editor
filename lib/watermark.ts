import { canvasFontFamily } from "./compose/fonts.ts"

export type WatermarkPrefs = {
  text: string
  loop: boolean
  opacityPct: number
  fontPx: number
  speed: number
}

export type WatermarkPaint = {
  text: string
  loop: boolean
  opacityPct: number
  fontPx: number
  speed: number
}

export type WatermarkFrame = { width: number; height: number }
export type WatermarkBox = { width: number; height: number }

export const DEFAULT_WATERMARK_PREFS: WatermarkPrefs = {
  text: "",
  loop: true,
  opacityPct: 22,
  fontPx: 42,
  speed: 1,
}
export const WATERMARK_OPACITY = 0.22
export const WATERMARK_FONT_PX = 42
export const WATERMARK_MARGIN_PX = 48
export const WATERMARK_SPEED_X = 90
export const WATERMARK_SPEED_Y = 110
export const WATERMARK_OPACITY_PCT_MIN = 8
export const WATERMARK_OPACITY_PCT_MAX = 50
export const WATERMARK_FONT_PX_MIN = 24
export const WATERMARK_FONT_PX_MAX = 80
export const WATERMARK_SPEED_MIN = 0.25
export const WATERMARK_SPEED_MAX = 3
export const WATERMARK_SPEED_STEP = 0.25
const TEXT_MAX = 40

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clampRound(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function clampSpeed(value: number): number {
  const snapped = Math.round(value / WATERMARK_SPEED_STEP) * WATERMARK_SPEED_STEP
  return Math.min(WATERMARK_SPEED_MAX, Math.max(WATERMARK_SPEED_MIN, snapped))
}

export function normalizeWatermarkPrefs(raw: unknown): WatermarkPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WATERMARK_PREFS }
  const record = raw as Record<string, unknown>
  let text = typeof record.text === "string" ? record.text : ""
  text = text.replace(/\n/g, " ").trim()
  if (text.length > TEXT_MAX) text = text.slice(0, TEXT_MAX)
  const loop = record.loop === undefined ? true : record.loop === true
  const opacityRaw = finiteNumber(record.opacityPct)
  const fontRaw = finiteNumber(record.fontPx)
  const speedRaw = finiteNumber(record.speed)
  return {
    text,
    loop,
    opacityPct:
      opacityRaw === null
        ? DEFAULT_WATERMARK_PREFS.opacityPct
        : clampRound(opacityRaw, WATERMARK_OPACITY_PCT_MIN, WATERMARK_OPACITY_PCT_MAX),
    fontPx:
      fontRaw === null
        ? DEFAULT_WATERMARK_PREFS.fontPx
        : clampRound(fontRaw, WATERMARK_FONT_PX_MIN, WATERMARK_FONT_PX_MAX),
    speed: speedRaw === null ? DEFAULT_WATERMARK_PREFS.speed : clampSpeed(speedRaw),
  }
}

export function watermarkPaintInput(
  enabled: boolean | undefined,
  prefs: WatermarkPrefs,
): WatermarkPaint | null {
  if (enabled !== true || !prefs.text) return null
  return {
    text: prefs.text,
    loop: prefs.loop,
    opacityPct: prefs.opacityPct,
    fontPx: prefs.fontPx,
    speed: prefs.speed,
  }
}

function axisRange(frameSize: number, boxSize: number): { min: number; max: number } {
  const half = boxSize / 2
  const min = WATERMARK_MARGIN_PX + half
  const max = frameSize - WATERMARK_MARGIN_PX - half
  if (!(max >= min)) {
    const mid = frameSize / 2
    return { min: mid, max: mid }
  }
  return { min, max }
}

export function pingPong(t: number, min: number, max: number, speed: number): number {
  const range = max - min
  if (!(range > 0) || !(speed > 0)) return max
  const span = 2 * range
  let u = (t * speed) % span
  if (u < 0) u += span
  return u <= range ? max - u : min + (u - range)
}

export function watermarkCenter(
  t: number,
  frame: WatermarkFrame,
  box: WatermarkBox,
  loop: boolean,
  speed = 1,
): { x: number; y: number } {
  const xRange = axisRange(frame.width, box.width)
  const yRange = axisRange(frame.height, box.height)
  if (!loop) return { x: xRange.max, y: yRange.max }
  return {
    x: pingPong(t, xRange.min, xRange.max, WATERMARK_SPEED_X * speed),
    y: pingPong(t, yRange.min, yRange.max, WATERMARK_SPEED_Y * speed),
  }
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  time: number,
  frame: WatermarkFrame,
  paint: WatermarkPaint | null | undefined,
): void {
  const text = paint?.text
  if (!text) return
  const visual = normalizeWatermarkPrefs(paint)
  ctx.save()
  ctx.globalAlpha = visual.opacityPct / 100
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${visual.fontPx}px ${canvasFontFamily("geist")}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const width = ctx.measureText(text).width
  const center = watermarkCenter(
    time,
    frame,
    { width, height: visual.fontPx },
    paint.loop,
    visual.speed,
  )
  ctx.fillText(text, center.x, center.y)
  ctx.restore()
}
