import { applyCanvasShadow } from "../compose/insert-style.ts"
import { wrapLines } from "../compose/wrap-lines.ts"
import { splitBubbleCopy } from "./copy.ts"
import type { ElementShape } from "./schema.ts"
import { seedFromId, wobbleEllipse, wobblePolyline } from "./wobble.ts"

export type ElementDrawModel = {
  id: string
  type: string
  shape: ElementShape
  x: number
  y: number
  width: number
  height: number
  text: string
  primary: string
  secondary: string
  fontFamily: string
  fontWeight: number
  uppercase: boolean
  fontPx: number
  radius: number
  shadow: "none" | "hard" | "soft"
  logoSrc?: string
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(Math.max(0, r), w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function lineWidthOf(ctx: CanvasRenderingContext2D, text: string, fontPx: number): number {
  if (typeof ctx.measureText === "function") {
    const width = ctx.measureText(text).width
    if (Number.isFinite(width) && width > 0) return width
  }
  return Math.max(text.length, 1) * fontPx * 0.52
}

function wrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontPx: number,
): string[] {
  if (!text) return []
  return wrapLines(text, maxWidth, (value) => lineWidthOf(ctx, value, fontPx))
}

function labelOf(model: ElementDrawModel): string {
  return model.uppercase ? model.text.toUpperCase() : model.text
}

function applyShadow(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  applyCanvasShadow(ctx, model.shadow, model.secondary)
}

function fillRound(ctx: CanvasRenderingContext2D, model: ElementDrawModel, color: string): void {
  roundRect(ctx, model.x, model.y, model.width, model.height, model.radius)
  ctx.fillStyle = color
  applyShadow(ctx, model)
  ctx.fill()
  applyCanvasShadow(ctx, "none", color)
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  model: ElementDrawModel,
  text: string,
  color: string,
  x: number,
  y: number,
): void {
  ctx.font = `${model.fontWeight} ${model.fontPx}px ${model.fontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = color
  applyShadow(ctx, model)
  ctx.fillText(text, x, y)
  applyCanvasShadow(ctx, "none", color)
}

function drawBag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, line: string): void {
  const w = size
  const h = size
  ctx.fillStyle = fill
  roundRect(ctx, x, y, w, h, size * 0.18)
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = Math.max(2, size * 0.08)
  ctx.strokeRect(x + w * 0.22, y + h * 0.38, w * 0.56, h * 0.48)
  ctx.beginPath()
  ctx.arc(x + w * 0.5, y + h * 0.38, w * 0.16, Math.PI, 0)
  ctx.stroke()
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, color: string): void {
  const inner = outer * 0.45
  ctx.beginPath()
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const b = a + Math.PI / 5
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
    ctx.lineTo(cx + Math.cos(b) * inner, cy + Math.sin(b) * inner)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function strokeWobble(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  color: string,
  width: number,
): void {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i]!.x, points[i]!.y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.stroke()
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  model: ElementDrawModel,
  getLogo?: (src: string) => CanvasImageSource | null,
): void {
  fillRound(ctx, model, model.primary)
  const bag = Math.min(model.height * 0.72, model.width * 0.42)
  const bagX = model.x + model.height * 0.16
  const bagY = model.y + (model.height - bag) / 2
  const image = model.logoSrc ? getLogo?.(model.logoSrc) ?? null : null
  if (image) {
    ctx.drawImage(image, bagX, bagY, bag, bag)
  } else {
    drawBag(ctx, bagX, bagY, bag, model.primary, model.secondary)
  }
  if (model.text) {
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.font = `${model.fontWeight} ${model.fontPx}px ${model.fontFamily}`
    ctx.fillStyle = model.secondary
    ctx.fillText(labelOf(model), bagX + bag + model.height * 0.12, model.y + model.height / 2)
  }
}

function drawBadge(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, model.primary)
  drawCenteredText(ctx, model, labelOf(model), model.secondary, model.x + model.width / 2, model.y + model.height / 2)
}

function drawPrice(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, "rgba(0,0,0,0.35)")
  const label = labelOf(model)
  drawCenteredText(ctx, model, label, model.primary, model.x + model.width / 2, model.y + model.height / 2)
  ctx.strokeStyle = model.secondary
  ctx.lineWidth = Math.max(3, model.fontPx * 0.12)
  ctx.beginPath()
  ctx.moveTo(model.x + model.width * 0.12, model.y + model.height / 2)
  ctx.lineTo(model.x + model.width * 0.88, model.y + model.height / 2)
  ctx.stroke()
}

function drawTicket(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, model.primary)
  ctx.save()
  ctx.setLineDash([Math.max(4, model.height * 0.12), Math.max(3, model.height * 0.08)])
  ctx.strokeStyle = model.secondary
  ctx.lineWidth = Math.max(2, model.height * 0.045)
  roundRect(
    ctx,
    model.x + 6,
    model.y + 6,
    model.width - 12,
    model.height - 12,
    Math.max(4, model.radius * 0.6),
  )
  ctx.stroke()
  ctx.restore()
  drawCenteredText(ctx, model, labelOf(model), model.secondary, model.x + model.width / 2, model.y + model.height / 2)
}

function drawCountdown(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, model.primary)
  drawCenteredText(ctx, model, labelOf(model) || "00:10:00", model.secondary, model.x + model.width / 2, model.y + model.height / 2)
}

function drawStock(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, "#FFFFFF")
  const label = labelOf(model) || "Restam 3"
  const digits = label.match(/(\d+)/)
  const left = digits ? Number(digits[1]) : 3
  const fill = Math.max(0.12, Math.min(0.92, left / 10))
  const barX = model.x + model.width * 0.08
  const barW = model.width * 0.84
  const barY = model.y + model.height * 0.62
  const barH = Math.max(6, model.height * 0.16)
  ctx.fillStyle = "rgba(0,0,0,0.12)"
  roundRect(ctx, barX, barY, barW, barH, barH / 2)
  ctx.fill()
  ctx.fillStyle = model.primary
  roundRect(ctx, barX, barY, barW * fill, barH, barH / 2)
  ctx.fill()
  ctx.font = `${model.fontWeight} ${model.fontPx * 0.72}px ${model.fontFamily}`
  ctx.fillStyle = model.secondary
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(label, model.x + model.width / 2, model.y + model.height * 0.34)
}

function drawStars(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, "rgba(0,0,0,0.45)")
  const pad = Math.max(10, model.fontPx * 0.42)
  const starR = Math.max(6, model.fontPx * 0.42)
  const startX = model.x + pad + starR
  const starY = model.y + pad + starR
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, startX + i * starR * 2.05, starY, starR, model.primary)
  }
  ctx.font = `${model.fontWeight} ${model.fontPx * 0.7}px ${model.fontFamily}`
  ctx.fillStyle = model.secondary
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  const lines = wrappedLines(ctx, labelOf(model), model.width - pad * 2, model.fontPx * 0.7)
  const lineH = model.fontPx * 0.85
  let y = starY + starR + model.fontPx * 0.28
  for (const line of lines) {
    ctx.fillText(line, model.x + pad, y)
    y += lineH
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  const cx = model.x + model.width / 2
  const label = labelOf(model)
  const labelH = label ? model.fontPx * 1.25 : 0
  const gap = label ? model.fontPx * 0.2 : 0
  if (label) {
    drawCenteredText(ctx, model, label, model.primary, cx, model.y + labelH / 2)
  }
  const iconTop = model.y + labelH + gap
  const iconH = Math.max(24, model.height - labelH - gap)
  const wingY = iconTop + iconH * 0.42
  const tipY = iconTop + iconH * 0.96
  const shaftL = model.x + model.width * 0.42
  const shaftR = model.x + model.width * 0.58
  ctx.fillStyle = model.primary
  applyShadow(ctx, model)
  ctx.beginPath()
  ctx.moveTo(cx, tipY)
  ctx.lineTo(model.x + model.width * 0.82, wingY)
  ctx.lineTo(shaftR, wingY)
  ctx.lineTo(shaftR, iconTop + iconH * 0.08)
  ctx.lineTo(shaftL, iconTop + iconH * 0.08)
  ctx.lineTo(shaftL, wingY)
  ctx.lineTo(model.x + model.width * 0.18, wingY)
  ctx.closePath()
  ctx.fill()
  applyCanvasShadow(ctx, "none", model.primary)
}

function drawBanner(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  ctx.fillStyle = model.primary
  ctx.fillRect(model.x, model.y, model.width, model.height)
  drawCenteredText(ctx, model, labelOf(model), model.secondary, model.x + model.width / 2, model.y + model.height / 2)
}

function drawHandArrow(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  const seed = seedFromId(model.id)
  const x0 = model.x + model.width * 0.12
  const y0 = model.y + model.height * 0.78
  const x1 = model.x + model.width * 0.82
  const y1 = model.y + model.height * 0.18
  const mid = [
    { x: x0, y: y0 },
    { x: (x0 + x1) / 2 + model.width * 0.04, y: (y0 + y1) / 2 },
    { x: x1, y: y1 },
  ]
  const shaft = wobblePolyline(mid, seed, model.height * 0.06)
  ctx.lineWidth = Math.max(4, model.height * 0.09)
  ctx.strokeStyle = model.primary
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  ctx.moveTo(shaft[0]!.x, shaft[0]!.y)
  ctx.quadraticCurveTo(shaft[1]!.x, shaft[1]!.y, shaft[2]!.x, shaft[2]!.y)
  ctx.stroke()
  const head = wobblePolyline(
    [
      { x: x1 - model.width * 0.22, y: y1 + model.height * 0.02 },
      { x: x1, y: y1 },
      { x: x1 - model.width * 0.08, y: y1 + model.height * 0.28 },
    ],
    seed + 3,
    model.height * 0.03,
  )
  strokeWobble(ctx, head, model.primary, Math.max(4, model.height * 0.09))
}

function drawCircle(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  const cx = model.x + model.width / 2
  const cy = model.y + model.height / 2
  const radius = Math.min(model.width, model.height) / 2 - 4
  const points = wobbleEllipse(cx, cy, radius, seedFromId(model.id))
  ctx.lineWidth = Math.max(4, model.height * 0.045)
  ctx.strokeStyle = model.primary
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]!.x, points[i]!.y)
  ctx.closePath()
  ctx.stroke()
}

function drawBubble(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, model.primary)
  const pad = Math.max(10, model.height * 0.08)
  const avatar = Math.min(model.fontPx * 1.85, Math.max(28, model.width * 0.16))
  const ax = model.x + pad
  const ay = model.y + pad
  ctx.fillStyle = model.secondary
  ctx.beginPath()
  ctx.arc(ax + avatar / 2, ay + avatar / 2, avatar / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = model.primary
  ctx.beginPath()
  ctx.arc(ax + avatar * 0.5, ay + avatar * 0.42, avatar * 0.16, 0, Math.PI * 2)
  ctx.fill()
  roundRect(ctx, ax + avatar * 0.18, ay + avatar * 0.58, avatar * 0.64, avatar * 0.28, avatar * 0.14)
  ctx.fill()
  const { user, body } = splitBubbleCopy(labelOf(model))
  const textX = ax + avatar + pad
  const textMax = Math.max(32, model.x + model.width - pad - textX)
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillStyle = model.secondary
  ctx.font = `700 ${model.fontPx * 0.62}px ${model.fontFamily}`
  ctx.fillText(user, textX, ay)
  if (body) {
    ctx.font = `${model.fontWeight} ${model.fontPx * 0.58}px ${model.fontFamily}`
    const lines = wrappedLines(ctx, body, textMax, model.fontPx * 0.58)
    const lineH = model.fontPx * 0.72
    let y = ay + model.fontPx * 0.78
    for (const line of lines) {
      ctx.fillText(line, textX, y)
      y += lineH
    }
  }
  ctx.beginPath()
  ctx.moveTo(model.x + model.width * 0.18, model.y + model.height)
  ctx.lineTo(model.x + model.width * 0.12, model.y + model.height + model.height * 0.08)
  ctx.lineTo(model.x + model.width * 0.3, model.y + model.height)
  ctx.closePath()
  ctx.fillStyle = model.primary
  ctx.fill()
}

function drawDivider(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  const cx = model.x + model.width / 2
  ctx.strokeStyle = model.primary
  ctx.lineWidth = Math.max(4, model.width * 0.18)
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(cx, model.y + 8)
  ctx.lineTo(cx, model.y + model.height - 8)
  ctx.stroke()
  ctx.fillStyle = model.secondary
  ctx.beginPath()
  ctx.arc(cx, model.y + model.height / 2, Math.max(6, model.width * 0.28), 0, Math.PI * 2)
  ctx.fill()
  const parts = labelOf(model).split(/\s{2,}| \s?/)
  const left = parts[0] || "ANTES"
  const right = parts[1] || "DEPOIS"
  ctx.font = `${model.fontWeight} ${Math.max(12, model.fontPx * 0.45)}px ${model.fontFamily}`
  ctx.fillStyle = model.primary
  ctx.textBaseline = "middle"
  ctx.textAlign = "right"
  ctx.fillText(left, cx - model.width * 0.7, model.y + 28)
  ctx.textAlign = "left"
  ctx.fillText(right, cx + model.width * 0.7, model.y + 28)
}

function drawSteps(ctx: CanvasRenderingContext2D, model: ElementDrawModel): void {
  fillRound(ctx, model, model.primary)
  const match = labelOf(model).match(/(\d+)\s*(?:de|\/)\s*(\d+)/i)
  const current = match?.[1] ?? "1"
  const total = match?.[2] ?? "3"
  const pillW = model.height * 0.9
  ctx.fillStyle = model.secondary
  roundRect(ctx, model.x + model.height * 0.12, model.y + model.height * 0.14, pillW, model.height * 0.72, model.height * 0.36)
  ctx.fill()
  ctx.fillStyle = model.primary
  ctx.font = `800 ${model.fontPx}px ${model.fontFamily}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(current, model.x + model.height * 0.12 + pillW / 2, model.y + model.height / 2)
  ctx.fillStyle = model.secondary
  ctx.font = `${model.fontWeight} ${model.fontPx * 0.7}px ${model.fontFamily}`
  ctx.textAlign = "left"
  ctx.fillText(`de ${total}`, model.x + model.height * 0.12 + pillW + model.height * 0.16, model.y + model.height / 2)
}

export function drawElement(
  ctx: CanvasRenderingContext2D,
  model: ElementDrawModel,
  getLogo?: (src: string) => CanvasImageSource | null,
): void {
  switch (model.shape) {
    case "logo":
      drawLogo(ctx, model, getLogo)
      return
    case "badge":
      drawBadge(ctx, model)
      return
    case "price":
      drawPrice(ctx, model)
      return
    case "ticket":
      drawTicket(ctx, model)
      return
    case "countdown":
      drawCountdown(ctx, model)
      return
    case "stock":
      drawStock(ctx, model)
      return
    case "stars":
      drawStars(ctx, model)
      return
    case "arrow":
      drawArrow(ctx, model)
      return
    case "banner":
      drawBanner(ctx, model)
      return
    case "hand-arrow":
      drawHandArrow(ctx, model)
      return
    case "circle":
      drawCircle(ctx, model)
      return
    case "bubble":
      drawBubble(ctx, model)
      return
    case "divider":
      drawDivider(ctx, model)
      return
    case "steps":
      drawSteps(ctx, model)
      return
    default:
      drawBadge(ctx, model)
  }
}
