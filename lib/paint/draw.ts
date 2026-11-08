import { brandKitOf } from "../brand/kits.ts"
import { resolveStyleColors } from "../brand/resolve-style-colors.ts"
import { PLAY_W } from "../compose/layout.ts"
import { backgroundEnvelope } from "../motion/engine.ts"
import { hashSeed } from "../motion/hash.ts"
import { animatedPoseAt, IDENTITY_POSE } from "../style/anim-engine.ts"
import type { InsertStyle } from "../style/types.ts"
import { layoutMarkedText, strikeLine, type InsertPaintLayout, type LayoutMeasure, type PaintPiece } from "./layout.ts"
import type { ProductData } from "../content/runs.ts"

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = radius >= 999 ? Math.min(w, h) / 2 : Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function paintShape(
  ctx: CanvasRenderingContext2D,
  box: InsertPaintLayout["bbox"],
  style: InsertStyle,
): void {
  const shape = style.text.shape
  if (shape === "tarja") {
    roundRect(ctx, -PLAY_W * 0.75, box.y, PLAY_W * 1.5, box.h, 0)
    ctx.fill()
    return
  }
  if (shape === "selo") {
    const size = Math.max(box.w, box.h)
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    ctx.beginPath()
    for (let point = 0; point < 28; point += 1) {
      const radius = (point % 2 === 0 ? 0.5 : 0.42) * size
      const angle = (point / 28) * Math.PI * 2 - Math.PI / 2
      const px = cx + Math.cos(angle) * radius
      const py = cy + Math.sin(angle) * radius
      if (point === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    return
  }
  if (shape === "fita") {
    const tooth = Math.max(4, box.w * 0.03)
    ctx.beginPath()
    ctx.moveTo(box.x + tooth, box.y)
    ctx.lineTo(box.x + box.w - tooth, box.y)
    const steps = Math.max(3, Math.round(box.h / tooth))
    for (let step = 0; step <= steps; step += 1) {
      const y = box.y + (box.h * step) / steps
      const x = box.x + box.w - (step % 2 === 0 ? 0 : tooth)
      ctx.lineTo(x, y)
    }
    ctx.lineTo(box.x + tooth, box.y + box.h)
    for (let step = steps; step >= 0; step -= 1) {
      const y = box.y + (box.h * step) / steps
      const x = box.x + (step % 2 === 0 ? 0 : tooth)
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    return
  }
  if (shape === "balao") {
    const tail = 26
    roundRect(ctx, box.x, box.y, box.w, box.h, style.text.background.radius)
    ctx.fill()
    const tipX = box.x + box.w * 0.22
    ctx.beginPath()
    ctx.moveTo(tipX, box.y + box.h - 1)
    ctx.lineTo(tipX + tail, box.y + box.h - 1)
    ctx.lineTo(tipX + tail * 0.35, box.y + box.h + tail)
    ctx.closePath()
    ctx.fill()
    return
  }
  if (shape === "etiqueta" && typeof document !== "undefined") {
    const notch = style.text.fontSize * 0.32
    const scratch = document.createElement("canvas")
    const scale = 2
    scratch.width = Math.ceil(box.w * scale) + 2
    scratch.height = Math.ceil(box.h * scale) + 2
    const local = scratch.getContext("2d")
    if (local) {
      local.scale(scale, scale)
      local.fillStyle = ctx.fillStyle
      roundRect(local, 0, 0, box.w, box.h, style.text.background.radius)
      local.fill()
      local.globalCompositeOperation = "destination-out"
      local.beginPath()
      local.arc(0, box.h / 2, notch, 0, Math.PI * 2)
      local.arc(box.w, box.h / 2, notch, 0, Math.PI * 2)
      local.fill()
      ctx.drawImage(scratch, box.x, box.y, box.w, box.h)
      return
    }
  }
  roundRect(ctx, box.x, box.y, box.w, box.h, style.text.background.radius)
  ctx.fill()
  if (style.text.glass) {
    ctx.strokeStyle = "rgba(255,255,255,0.4)"
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function fontOf(piece: PaintPiece): string {
  const italic = piece.font.italic ? "italic " : ""
  return `${italic}${piece.font.weight} ${piece.font.size}px "${piece.font.family}"`
}

export function highlightBarRect(
  line: { y: number; height: number; pieces: Array<{ x: number; width: number }> },
  fontSize: number,
): { cx: number; cy: number; w: number; h: number } | null {
  if (line.pieces.length === 0) return null
  const pad = fontSize * 0.15
  const minX = Math.min(...line.pieces.map((piece) => piece.x)) - pad
  const maxX = Math.max(...line.pieces.map((piece) => piece.x + piece.width)) + pad
  const top = line.y - line.height / 2 + line.height * 0.52
  const height = line.height * 0.4
  return { cx: (minX + maxX) / 2, cy: top + height / 2, w: maxX - minX, h: height }
}

export function deviceScaleOf(ctx: CanvasRenderingContext2D): number {
  if (typeof ctx.getTransform !== "function") return 1
  const matrix = ctx.getTransform()
  if (!matrix || typeof matrix.a !== "number") return 1
  const scale = Math.hypot(matrix.a, matrix.b)
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function paintPiece(ctx: CanvasRenderingContext2D, piece: PaintPiece, style: InsertStyle, strokeScale: number): void {
  ctx.save()
  ctx.font = fontOf(piece)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.globalAlpha *= piece.opacity
  if (piece.font.letterSpacing && "letterSpacing" in ctx) {
    ctx.letterSpacing = `${piece.font.letterSpacing * piece.font.size}px`
  }
  if (piece.missing) {
    const padX = piece.font.size * 0.12
    const padY = piece.font.size * 0.08
    ctx.fillStyle = "#FDF1D8"
    roundRect(ctx, piece.x - padX, piece.y - piece.font.size * 0.65, piece.width + padX * 2, piece.font.size * 1.3, 3)
    ctx.fill()
  }
  const fill = piece.accent || !style.text.gradient.enabled ? piece.color : lineGradient(ctx, piece, style)
  const stroke = style.text.stroke
  const strokeWidth = piece.strike || piece.missing || !stroke.enabled ? 0 : stroke.width * strokeScale
  ctx.lineJoin = "round"
  if (style.text.outerStroke && strokeWidth > 0) {
    ctx.strokeStyle = style.text.outerStroke.color
    ctx.lineWidth = 2 * (strokeWidth / 2 + style.text.outerStroke.width * strokeScale)
    ctx.strokeText(piece.text, piece.x, piece.y)
  }
  if (strokeWidth > 0) {
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = strokeWidth
    ctx.strokeText(piece.text, piece.x, piece.y)
  }
  const pixelScale = deviceScaleOf(ctx)
  if (style.text.longShadow && !piece.missing) {
    ctx.fillStyle = style.text.longShadow.color
    for (let step = style.text.longShadow.length; step >= 1; step -= 1) {
      const shift = step * 1.4 * strokeScale
      ctx.fillText(piece.text, piece.x + shift, piece.y + shift)
    }
  }
  if (!style.text.boxShadow && style.text.shadows.length > 0 && piece.color !== "transparent") {
    for (const shadow of style.text.shadows) {
      ctx.save()
      ctx.shadowOffsetX = shadow.x * pixelScale
      ctx.shadowOffsetY = shadow.y * pixelScale
      ctx.shadowBlur = shadow.blur * pixelScale
      ctx.shadowColor = shadow.color
      ctx.fillStyle = fill
      ctx.fillText(piece.text, piece.x, piece.y)
      ctx.restore()
    }
  }
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.fillStyle = fill
  if (piece.color !== "transparent") ctx.fillText(piece.text, piece.x, piece.y)
  const line = strikeLine(piece)
  if (line) {
    ctx.strokeStyle = piece.color
    ctx.lineWidth = line.thickness
    ctx.beginPath()
    ctx.moveTo(line.x0, line.y)
    ctx.lineTo(line.x1, line.y)
    ctx.stroke()
  }
  ctx.restore()
}

function lineGradient(
  ctx: CanvasRenderingContext2D,
  piece: PaintPiece,
  style: InsertStyle,
): CanvasGradient {
  const angle = ((style.text.gradient.angle + 90) * Math.PI) / 180
  const gradient = ctx.createLinearGradient(
    piece.x,
    piece.y - piece.font.size / 2,
    piece.x + Math.cos(angle) * Math.max(piece.width, 1),
    piece.y - piece.font.size / 2 + Math.sin(angle) * piece.font.size,
  )
  gradient.addColorStop(0, style.text.gradient.from)
  gradient.addColorStop(1, style.text.gradient.to)
  return gradient
}

export type PaintMotion = {
  time: number
  fps: number
  start: number
  duration: number
  seed: string
  /** Miniatura: deslocamentos do motor são px do quadro 1080 e precisam do mesmo `s`. */
  unitScale?: number
}

/** Caixa do fundo quando a unidade é letra ou palavra. No bloco a caixa segue o texto inteiro. */
export function insertBackgroundMotion(
  style: InsertStyle,
  motion: PaintMotion | undefined,
  unitCount: number,
): { opacity: number; scale: number } | null {
  if (!motion || style.animation.unit === "bloco") return null
  const hasBox = style.text.background.enabled || Boolean(style.text.highlightBar) || Boolean(style.text.shape)
  if (!hasBox) return null
  const fps = motion.fps > 0 ? motion.fps : 30
  return backgroundEnvelope(
    motion.time * fps,
    {
      animation: style.animation,
      startFrame: (motion.start ?? 0) * fps,
      durationInFrames: Math.max(0, (motion.duration ?? 0) * fps),
    },
    Math.max(1, unitCount),
  )
}

export function paintInsertLayout(
  ctx: CanvasRenderingContext2D,
  layout: InsertPaintLayout,
  style: InsertStyle,
  origin: { cx: number; cy: number },
  motion?: PaintMotion,
): void {
  ctx.save()
  ctx.translate(origin.cx, origin.cy)
  if (style.text.rotation) ctx.rotate((style.text.rotation * Math.PI) / 180)
  ctx.globalAlpha *= Math.max(0, Math.min(1, style.text.opacity / 100))
  const strokeScale = 1
  const fps = motion && motion.fps > 0 ? motion.fps : 30
  const frame = (motion?.time ?? 0) * fps
  const unitCount = Math.max(1, layout.pieces.length)
  const boxMotion = insertBackgroundMotion(style, motion, unitCount)
  const unitScale = motion?.unitScale ?? 1
  if (boxMotion && boxMotion.opacity > 0) {
    const centerX = layout.bbox.x + layout.bbox.w / 2
    const centerY = layout.bbox.y + layout.bbox.h / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(boxMotion.scale, boxMotion.scale)
    ctx.translate(-centerX, -centerY)
    ctx.globalAlpha *= boxMotion.opacity
  }
  const paintBox = !boxMotion || boxMotion.opacity > 0
  if (style.text.background.enabled && paintBox) {
    ctx.save()
    ctx.globalAlpha *= Math.max(0, Math.min(1, style.text.background.opacity / 100))
    ctx.fillStyle = style.text.background.color
    if (style.text.boxShadow) {
      const shadow = style.text.shadows[0]
      const pixelScale = deviceScaleOf(ctx)
      if (shadow) {
        ctx.shadowOffsetX = shadow.x * pixelScale
        ctx.shadowOffsetY = shadow.y * pixelScale
        ctx.shadowBlur = shadow.blur * pixelScale
        ctx.shadowColor = shadow.color
      }
    }
    paintShape(ctx, layout.bbox, style)
    ctx.restore()
  }
  if (style.text.highlightBar && paintBox) {
    ctx.save()
    ctx.fillStyle = style.text.highlightBar.color
    for (const line of layout.lines) {
      const bar = highlightBarRect(line, style.text.fontSize)
      if (!bar) continue
      ctx.save()
      ctx.translate(bar.cx, bar.cy)
      ctx.rotate((style.text.highlightBar.skew * Math.PI) / 180)
      ctx.fillRect(-bar.w / 2, -bar.h / 2, bar.w, bar.h)
      ctx.restore()
    }
    ctx.restore()
  }
  if (boxMotion && boxMotion.opacity > 0) ctx.restore()
  layout.pieces.forEach((piece, index) => {
    const pose =
      !motion || style.animation.unit === "bloco"
        ? motion
          ? animatedPoseAt({
              anim: style.animation,
              indexInCard: 0,
              cardStartFrame: (motion.start ?? 0) * fps,
              cardDurationFrames: Math.max(0, (motion.duration ?? 0) * fps),
              frame,
              fps,
              unitCount: 1,
              seed: hashSeed(motion.seed),
            })
          : IDENTITY_POSE
        : animatedPoseAt({
            anim: style.animation,
            indexInCard: index,
            cardStartFrame: motion.start * fps,
            cardDurationFrames: Math.max(0, motion.duration * fps),
            frame,
            fps,
            unitCount,
            seed: hashSeed(motion.seed),
          })
    ctx.save()
    const cx = piece.x + piece.width / 2
    ctx.translate(cx, piece.y)
    ctx.translate(pose.x * unitScale, pose.y * unitScale)
    ctx.rotate((pose.rotate * Math.PI) / 180)
    ctx.scale(pose.scale * pose.scaleX, pose.scale * pose.scaleY)
    ctx.translate(-cx, -piece.y)
    ctx.globalAlpha *= pose.opacity
    paintPiece(ctx, piece, style, strokeScale)
    ctx.restore()
  })
  if (style.text.underline && layout.lines.length > 0) {
    const last = layout.lines[layout.lines.length - 1]
    if (last && last.pieces.length > 0) {
      const minX = Math.min(...last.pieces.map((piece) => piece.x))
      const maxX = Math.max(...last.pieces.map((piece) => piece.x + piece.width))
      ctx.strokeStyle = style.text.accent || style.text.highlight.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(minX, last.y + last.height / 2 + 6)
      ctx.lineTo(maxX, last.y + last.height / 2 + 6)
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Encolhe fonte, contorno, padding e sombra pelo `s` da miniatura. */
export function scalePaintStyle(style: InsertStyle, factor: number): InsertStyle {
  if (!(factor > 0) || Math.abs(factor - 1) < 1e-6) return style
  const text = style.text
  return {
    ...style,
    text: {
      ...text,
      fontSize: text.fontSize * factor,
      stroke: { ...text.stroke, width: text.stroke.width * factor },
      ...(text.outerStroke
        ? { outerStroke: { ...text.outerStroke, width: text.outerStroke.width * factor } }
        : {}),
      background: {
        ...text.background,
        paddingX: text.background.paddingX * factor,
        paddingY: text.background.paddingY * factor,
        radius: text.background.radius >= 999 ? text.background.radius : text.background.radius * factor,
      },
      shadows: text.shadows.map((shadow) => ({
        ...shadow,
        x: shadow.x * factor,
        y: shadow.y * factor,
        blur: shadow.blur * factor,
      })),
      ...(text.longShadow
        ? { longShadow: { ...text.longShadow, length: text.longShadow.length * factor } }
        : {}),
    },
  }
}

export function paintMarkedInsert(
  ctx: CanvasRenderingContext2D,
  input: {
    text: string
    style: InsertStyle
    maxWidth: number
    measure: LayoutMeasure
    origin: { cx: number; cy: number }
    productData?: ProductData
    editPreview?: boolean
    brandKitId?: string
    motion?: PaintMotion
  },
): InsertPaintLayout {
  const style = resolveStyleColors(input.style, brandKitOf(input.brandKitId))
  const layout = layoutMarkedText({ ...input, style })
  paintInsertLayout(ctx, layout, style, input.origin, input.motion)
  return layout
}
