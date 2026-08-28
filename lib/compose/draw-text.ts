import type { CompositionInsert } from "../composition.ts"
import { layoutInsertText, canvasTextMeasure } from "./layout-text.ts"
import { resolveLayerStyle } from "./resolve-style.ts"
import { applyCanvasShadow } from "./insert-style.ts"
import { animAt, applyAnimPose } from "./anim.ts"

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function drawStyledText(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  frame: { width: number; height: number },
  brandFontId: string,
  time: number,
): void {
  const style = resolveLayerStyle(insert, brandFontId)
  const layout = layoutInsertText(
    insert,
    brandFontId,
    frame,
    canvasTextMeasure(ctx, style.fontWeight, style.fontFamily),
  )
  if (!layout) return

  const { lines, blockW, blockH, effectiveFontSize, cx, cy } = layout
  const lineHeight = effectiveFontSize * style.lineHeight
  const strokeScale = effectiveFontSize / Math.max(1, style.fontSize)
  ctx.save()
  ctx.font = `${style.fontWeight} ${effectiveFontSize}px ${style.fontFamily}`
  applyAnimPose(ctx, animAt(insert, time), {
    cx,
    cy,
    w: blockW,
    h: blockH,
  })
  ctx.translate(cx, cy)
  if (style.rotation) ctx.rotate((style.rotation * Math.PI) / 180)
  ctx.globalAlpha *= style.opacity

  if (style.bgColor) {
    const padX = effectiveFontSize * 0.4
    const padY = effectiveFontSize * 0.22
    const bgW = blockW + padX * 2
    const bgH = blockH + padY * 2
    const radius =
      style.pillRadius === 999 ? bgH / 2 : (style.pillRadius ?? 8) * strokeScale
    ctx.save()
    ctx.globalAlpha *= style.bgOpacity ?? 1
    ctx.fillStyle = style.bgColor
    roundRect(ctx, -bgW / 2, -bgH / 2, bgW, bgH, radius)
    ctx.fill()
    ctx.restore()
  }

  ctx.textBaseline = "middle"
  ctx.textAlign = style.textAlign
  let textX = 0
  if (style.textAlign === "left") textX = -blockW / 2
  if (style.textAlign === "right") textX = blockW / 2

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined) continue
    const y = -blockH / 2 + lineHeight / 2 + index * lineHeight
    applyCanvasShadow(ctx, style.shadow, style.color)
    if (style.stroke) {
      ctx.lineJoin = "round"
      ctx.miterLimit = 2
      ctx.strokeStyle = style.stroke.color
      ctx.lineWidth = style.stroke.width * strokeScale
      ctx.strokeText(line, textX, y)
    }
    ctx.fillStyle = style.color
    ctx.fillText(line, textX, y)
    applyCanvasShadow(ctx, "none", style.color)
  }
  ctx.restore()
}
