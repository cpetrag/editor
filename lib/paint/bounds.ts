import type { CompositionInsert } from "../composition.ts"
import { PLAY_H, PLAY_W } from "../compose/layout.ts"
import { resolveInsertStyle } from "../style/resolve-insert-style.ts"
import type { InsertStyle } from "../style/types.ts"
import { BALLOON_TAIL } from "./draw.ts"
import { fitMarkedLayout, PAINT_MAX_WIDTH_PCT, spacedMeasure, type InsertPaintLayout } from "./layout.ts"

export interface PaintRect {
  x: number
  y: number
  w: number
  h: number
}

/** Caixa desenhada: texto, forma (estrela, rabinho), contorno e sombra. */
export function decoratedLocalBounds(bbox: InsertPaintLayout["bbox"], style: InsertStyle): PaintRect {
  let x = bbox.x
  let y = bbox.y
  let w = bbox.w
  let h = bbox.h
  const shape = style.text.shape
  if (shape === "selo") {
    const size = Math.max(w, h)
    const cx = x + w / 2
    const cy = y + h / 2
    x = cx - size / 2
    y = cy - size / 2
    w = size
    h = size
  } else if (shape === "balao") {
    h += BALLOON_TAIL
  } else if (shape === "fita") {
    const tooth = Math.max(4, w * 0.03)
    x -= tooth
    w += tooth * 2
  }
  const stroke =
    (style.text.stroke.enabled ? style.text.stroke.width : 0) + (style.text.outerStroke?.width ?? 0)
  let left = stroke
  let right = stroke
  let top = stroke
  let bottom = stroke
  for (const shadow of style.text.shadows) {
    left = Math.max(left, Math.max(0, -shadow.x) + shadow.blur)
    right = Math.max(right, Math.max(0, shadow.x) + shadow.blur)
    top = Math.max(top, Math.max(0, -shadow.y) + shadow.blur)
    bottom = Math.max(bottom, Math.max(0, shadow.y) + shadow.blur)
  }
  const long = style.text.longShadow?.length ?? 0
  right += long
  bottom += long
  return { x: x - left, y: y - top, w: w + left + right, h: h + top + bottom }
}

function worldRect(local: PaintRect, anchorX: number, anchorY: number, rotation: number): PaintRect {
  const corners = [
    [local.x, local.y],
    [local.x + local.w, local.y],
    [local.x + local.w, local.y + local.h],
    [local.x, local.y + local.h],
  ]
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [px, py] of corners) {
    const rx = anchorX + px * cos - py * sin
    const ry = anchorY + px * sin + py * cos
    minX = Math.min(minX, rx)
    minY = Math.min(minY, ry)
    maxX = Math.max(maxX, rx)
    maxY = Math.max(maxY, ry)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Retângulo no quadro 1080×1920 da caixa que o preview e o render pintam. */
export function insertPaintRect(
  insert: CompositionInsert,
  frame: { width: number; height: number } = { width: PLAY_W, height: PLAY_H },
): PaintRect | null {
  if (insert.kind === "caption" || insert.type === "legenda") return null
  if (!insert.styleRef && insert.kind !== "text") return null
  const text = insert.text ?? ""
  if (!text.trim() && insert.kind === "text") return null
  const painted = resolveInsertStyle(insert, { frameWidth: frame.width })
  const rawPct = Number.isFinite(painted.text.maxWidth) ? painted.text.maxWidth : PAINT_MAX_WIDTH_PCT
  const pct = Math.min(PAINT_MAX_WIDTH_PCT, Math.max(20, rawPct))
  const fitted = fitMarkedLayout({
    text,
    style: painted,
    maxWidth: (pct / 100) * frame.width,
    measure: spacedMeasure,
    editPreview: true,
  })
  const local = decoratedLocalBounds(fitted.layout.bbox, fitted.style)
  return worldRect(local, (painted.text.x / 100) * frame.width, (painted.text.y / 100) * frame.height, painted.text.rotation)
}

export function rectsIntersect(a: PaintRect, b: PaintRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}
