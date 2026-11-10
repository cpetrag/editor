import { offerStylePatch } from "../style/offer-styles.ts"
import { paintMarkedInsert } from "../paint/draw.ts"
import { PAINT_MAX_WIDTH_PCT } from "../paint/layout.ts"
import { brandKitOf } from "../brand/kits.ts"
import { resolveStyleColors } from "../brand/resolve-style-colors.ts"
import { displayRuns, tagToken, type ProductData } from "../content/runs.ts"
import { clipRect, frameGlowRadius } from "../motion/css.ts"
import { hashSeed } from "../motion/hash.ts"
import { IDENTITY_POSE, type AnimPose } from "../style/anim-engine.ts"
import { planStyledTextDraw, type PlannedToken, type StyledTextPlan, visibleGlyphCount, warnInvisibleCaptionPaint } from "../style/caption-draw.ts"
import type { Animation, InsertStyle } from "../style/types.ts"
import type { CompositionInsert } from "../composition.ts"
import { DEFAULT_FPS } from "../composition.ts"
import { toAbsoluteCaptionWords } from "../caption-time.ts"
import { canvasFontFamily } from "./fonts.ts"
import { PLAY_W } from "./layout.ts"
import { clampFontWeight, parseFontId, type FontWeight } from "./insert-style.ts"
import { layoutInsertText, canvasTextMeasure } from "./layout-text.ts"
import { resolveLayerStyle } from "./resolve-style.ts"

function applyPose(
  ctx: CanvasRenderingContext2D,
  pose: AnimPose,
  originX: number,
  originY: number,
  hint?: {
    origin?: Animation["origin"]
    clipDir?: Animation["clipDir"]
    accent?: string
    box?: { w: number; h: number }
  },
): void {
  let pivotX = originX
  let pivotY = originY
  if (hint?.box && hint.origin === "base") pivotY = originY + hint.box.h / 2
  if (hint?.box && hint.origin === "topo") pivotY = originY - hint.box.h / 2

  ctx.translate(pivotX, pivotY)
  ctx.translate(pose.x, pose.y)
  const rotateX = ((pose.rotateX ?? 0) * Math.PI) / 180
  const rotateY = ((pose.rotateY ?? 0) * Math.PI) / 180
  if (rotateX !== 0 || rotateY !== 0) ctx.scale(Math.cos(rotateY), Math.cos(rotateX))
  ctx.rotate((pose.rotate * Math.PI) / 180)
  const skew = ((pose.skewX ?? 0) * Math.PI) / 180
  if (skew !== 0) ctx.transform(1, 0, Math.tan(skew), 1, 0, 0)
  ctx.scale(pose.scale * (pose.scaleX ?? 1), pose.scale * (pose.scaleY ?? 1))
  ctx.globalAlpha *= pose.opacity
  const filters: string[] = []
  if (pose.blur > 0) filters.push(`blur(${pose.blur}px)`)
  if ((pose.brightness ?? 1) !== 1) filters.push(`brightness(${pose.brightness})`)
  if ((pose.glow ?? 0) > 0 && hint?.accent) {
    filters.push(`drop-shadow(0 0 ${frameGlowRadius(pose.glow)}px ${hint.accent})`)
  }
  if (filters.length > 0) ctx.filter = filters.join(" ")
  ctx.translate(-pivotX, -pivotY)

  if ((pose.clip ?? 0) > 0 && hint?.box) {
    const rect = clipRect(pose.clip, hint.clipDir ?? "esq", {
      x: originX - hint.box.w / 2,
      y: originY - hint.box.h / 2,
      w: hint.box.w,
      h: hint.box.h,
    })
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
  }
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r)
  } else {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
  }
  ctx.fill()
}

function tokenFill(
  ctx: CanvasRenderingContext2D,
  style: InsertStyle,
  token: PlannedToken,
  lineHeight: number,
): string | CanvasGradient {
  if (!style.text.gradient.enabled) return token.fill
  if (token.fill !== style.text.color) return token.fill
  const angle = (style.text.gradient.angle * Math.PI) / 180
  const gradient = ctx.createLinearGradient(
    token.x,
    token.y - lineHeight / 2,
    token.x + Math.cos(angle) * Math.max(token.width, 1),
    token.y + Math.sin(angle) * lineHeight,
  )
  gradient.addColorStop(0, style.text.gradient.from)
  gradient.addColorStop(1, style.text.gradient.to)
  return gradient
}

function paintGlyph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string | CanvasGradient,
  stroke: InsertStyle["text"]["stroke"],
  strokeWidth: number,
  outer?: { width: number; color: string },
): void {
  ctx.lineJoin = "round"
  ctx.miterLimit = 2
  if (outer && outer.width > 0) {
    ctx.strokeStyle = outer.color
    ctx.lineWidth = 2 * (strokeWidth / 2 + outer.width)
    ctx.strokeText(text, x, y)
  }
  if (stroke.enabled && strokeWidth > 0) {
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = strokeWidth
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

function paintPriceGlyph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string | CanvasGradient,
): void {
  const match = text.match(/^(R\$)\s*(\d[\d.]*)(?:,(\d{2}))?$/)
  if (!match) {
    ctx.fillStyle = fill
    ctx.fillText(text, x, y)
    return
  }
  const symbol = match[1] ?? "R$"
  const whole = match[2] ?? ""
  const cents = match[3] ? `,${match[3]}` : ""
  ctx.fillStyle = fill
  ctx.save()
  ctx.font = ctx.font.replace(/(\d+(?:\.\d+)?)px/, `${size * 0.42}px`)
  ctx.textBaseline = "top"
  ctx.fillText(symbol, x, y - size * 0.5)
  const symbolWidth = ctx.measureText(symbol).width
  ctx.restore()
  ctx.fillStyle = fill
  ctx.fillText(whole, x + symbolWidth + size * 0.06, y)
  if (cents) {
    const wholeWidth = ctx.measureText(whole).width
    ctx.save()
    ctx.font = ctx.font.replace(/(\d+(?:\.\d+)?)px/, `${size * 0.45}px`)
    ctx.textBaseline = "top"
    ctx.fillStyle = fill
    ctx.fillText(cents, x + symbolWidth + size * 0.06 + wholeWidth, y - size * 0.5)
    ctx.restore()
  }
}

function blockBox(plan: StyledTextPlan, lineHeight: number): { w: number; h: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  for (const token of plan.tokens) grow(token.x, token.y - lineHeight / 2, token.width, lineHeight)
  for (const rect of plan.backgrounds) grow(rect.x, rect.y, rect.w, rect.h)
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return { w: 1, h: 1 }
  return { w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }
}

function groupByWord(tokens: PlannedToken[]): PlannedToken[][] {
  const groups = new Map<number, PlannedToken[]>()
  for (const token of tokens) {
    const list = groups.get(token.wordIndex) ?? []
    list.push(token)
    groups.set(token.wordIndex, list)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => group)
}

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number; r: number },
  style: InsertStyle,
  fontSize: number,
): void {
  const shape = style.text.shape
  if (shape === "tarja") {
    fillRoundRect(ctx, -PLAY_W * 0.75, rect.y, PLAY_W * 1.5, rect.h, 0)
    return
  }
  if (shape === "selo") {
    const size = Math.max(rect.w, rect.h)
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const spikes = 14
    ctx.beginPath()
    for (let point = 0; point < spikes * 2; point += 1) {
      const radius = (point % 2 === 0 ? 0.5 : 0.42) * size
      const angle = (point / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
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
    const tooth = rect.w * 0.03
    ctx.beginPath()
    ctx.moveTo(rect.x + tooth, rect.y)
    ctx.lineTo(rect.x + rect.w - tooth, rect.y)
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h / 2)
    ctx.lineTo(rect.x + rect.w - tooth, rect.y + rect.h)
    ctx.lineTo(rect.x + tooth, rect.y + rect.h)
    ctx.lineTo(rect.x, rect.y + rect.h / 2)
    ctx.closePath()
    ctx.fill()
    return
  }
  if (shape === "balao") {
    const tail = 26 * (fontSize / 64)
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r)
    const tipX = rect.x + rect.w * 0.22
    ctx.beginPath()
    ctx.moveTo(tipX, rect.y + rect.h - 1)
    ctx.lineTo(tipX + tail, rect.y + rect.h - 1)
    ctx.lineTo(tipX + tail * 0.35, rect.y + rect.h + tail)
    ctx.closePath()
    ctx.fill()
    return
  }
  if (shape === "etiqueta") {
    const notch = fontSize * 0.32
    if (typeof document === "undefined") {
      fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r)
      return
    }
    const scratch = document.createElement("canvas")
    const scale = 2
    scratch.width = Math.ceil(rect.w * scale) + 4
    scratch.height = Math.ceil(rect.h * scale) + 4
    const local = scratch.getContext("2d")
    if (!local) {
      fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r)
      return
    }
    local.scale(scale, scale)
    local.fillStyle = ctx.fillStyle
    fillRoundRect(local, 0, 0, rect.w, rect.h, rect.r)
    local.globalCompositeOperation = "destination-out"
    local.beginPath()
    local.arc(0, rect.h / 2, notch, 0, Math.PI * 2)
    local.arc(rect.w, rect.h / 2, notch, 0, Math.PI * 2)
    local.fill()
    ctx.save()
    ctx.globalCompositeOperation = "source-over"
    ctx.drawImage(scratch, rect.x, rect.y, rect.w, rect.h)
    ctx.restore()
    return
  }
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r)
  if (style.text.glass) {
    ctx.save()
    ctx.strokeStyle = "rgba(255,255,255,0.4)"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }
}

function paintHighlightBars(ctx: CanvasRenderingContext2D, plan: StyledTextPlan, style: InsertStyle, lineHeight: number): void {
  const bar = style.text.highlightBar
  if (!bar) return
  ctx.save()
  ctx.fillStyle = bar.color
  const seen = new Set<number>()
  for (const token of plan.tokens) {
    if (seen.has(token.y)) continue
    seen.add(token.y)
    const lineTokens = plan.tokens.filter((item) => item.y === token.y)
    const minX = Math.min(...lineTokens.map((item) => item.x))
    const maxX = Math.max(...lineTokens.map((item) => item.x + item.width))
    const top = token.y - lineHeight / 2 + lineHeight * 0.52
    const height = lineHeight * 0.4
    ctx.save()
    ctx.translate(minX, token.y)
    ctx.rotate((bar.skew * Math.PI) / 180)
    ctx.fillRect(0, top - token.y, maxX - minX, height)
    ctx.restore()
  }
  ctx.restore()
}

export function paintStyledTextPlan(
  ctx: CanvasRenderingContext2D,
  plan: StyledTextPlan,
  style: InsertStyle,
  origin: { cx: number; cy: number },
  font: { family: string; weight: number; size: number },
  lineHeight: number,
  strokeScale: number,
): void {
  ctx.save()
  ctx.translate(origin.cx, origin.cy)
  if (style.text.rotation) ctx.rotate((style.text.rotation * Math.PI) / 180)
  ctx.globalAlpha *= Math.max(0, Math.min(1, style.text.opacity / 100))
  const italic = style.text.italic ? "italic " : ""
  ctx.font = `${italic}${font.weight} ${font.size}px ${font.family}`
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"
  const letterSpacing = style.text.letterSpacing * font.size
  if (letterSpacing && "letterSpacing" in ctx) {
    ctx.letterSpacing = `${letterSpacing}px`
  }

  const blockUnit = style.animation.unit === "bloco"
  const blockPose = blockUnit ? (plan.tokens[0]?.pose ?? IDENTITY_POSE) : IDENTITY_POSE
  const poseHint = {
    origin: style.animation.origin,
    clipDir: style.animation.clipDir,
    accent: style.text.highlight.color,
  }
  if (blockUnit) {
    ctx.save()
    applyPose(ctx, blockPose, 0, 0, { ...poseHint, box: blockBox(plan, lineHeight) })
  }

  if (style.text.background.enabled && style.text.background.mode !== "por-palavra") {
    ctx.save()
    ctx.globalAlpha *= Math.max(0, Math.min(1, style.text.background.opacity / 100))
    if (plan.backgroundMotion) {
      ctx.globalAlpha *= Math.max(0, plan.backgroundMotion.opacity)
      ctx.scale(plan.backgroundMotion.scale, plan.backgroundMotion.scale)
    }
    ctx.fillStyle = style.text.background.color
    if (style.text.boxShadow) {
      for (const shadow of style.text.shadows) {
        ctx.shadowOffsetX = shadow.x * strokeScale
        ctx.shadowOffsetY = shadow.y * strokeScale
        ctx.shadowBlur = shadow.blur * strokeScale
        ctx.shadowColor = shadow.color
      }
    }
    for (const rect of plan.backgrounds) {
      paintBackdrop(ctx, rect, style, font.size)
    }
    ctx.restore()
  }

  paintHighlightBars(ctx, plan, style, lineHeight)

  const strokeWidth = style.text.stroke.width * strokeScale
  const perTokenPose = !blockUnit

  for (let index = 0; index < plan.tokens.length; index += 1) {
    const token = plan.tokens[index]
    if (!token) continue
    ctx.save()
    const cx = token.x + token.width / 2
    const cy = token.y
    const pose = perTokenPose
      ? { ...token.pose, scale: token.pose.scale * token.scale }
      : { ...IDENTITY_POSE, scale: token.scale }
    applyPose(ctx, pose, cx, cy, { ...poseHint, box: { w: token.width, h: lineHeight } })

    if (style.text.background.enabled && style.text.background.mode === "por-palavra") {
      const firstOfWord = plan.tokens.findIndex((entry) => entry.wordIndex === token.wordIndex) === index
      const rect = plan.backgrounds[token.wordIndex]
      if (firstOfWord && rect) {
        ctx.save()
        ctx.globalAlpha *= Math.max(0, Math.min(1, style.text.background.opacity / 100))
        ctx.fillStyle = style.text.background.color
        fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r)
        ctx.restore()
      }
    }

    if (token.boxColor) {
      const padX = font.size * 0.12
      const padY = font.size * 0.08
      ctx.fillStyle = token.boxColor
      fillRoundRect(
        ctx,
        token.x - padX,
        token.y - lineHeight / 2 - padY,
        token.width + padX * 2,
        lineHeight + padY * 2,
        4 * strokeScale,
      )
    }

    if (token.accent && style.text.accentFont) {
      ctx.font = `${font.weight} ${font.size * 1.12}px ${canvasFontFamily(style.text.accentFont)}`
    } else if (token.strike) {
      ctx.font = `${italic}${font.weight} ${font.size * 0.5}px ${font.family}`
      ctx.globalAlpha *= 0.9
    }

    const textShadows = style.text.boxShadow ? [] : style.text.shadows
    if (style.text.gradient.enabled && textShadows.length > 0) {
      ctx.filter = textShadows
        .map(
          (shadow) =>
            `drop-shadow(${shadow.x * strokeScale}px ${shadow.y * strokeScale}px ${shadow.blur * strokeScale}px ${shadow.color})`,
        )
        .join(" ")
    } else {
      for (const shadow of textShadows) {
        ctx.save()
        ctx.shadowOffsetX = shadow.x * strokeScale
        ctx.shadowOffsetY = shadow.y * strokeScale
        ctx.shadowBlur = shadow.blur * strokeScale
        ctx.shadowColor = shadow.color
        ctx.fillStyle = token.fill
        ctx.fillText(token.text, token.x, token.y)
        ctx.restore()
      }
    }

    if (style.text.longShadow) {
      ctx.save()
      ctx.fillStyle = style.text.longShadow.color
      for (let step = style.text.longShadow.length; step >= 1; step -= 1) {
        ctx.fillText(token.text, token.x + step * 1.4 * strokeScale, token.y + step * 1.4 * strokeScale)
      }
      ctx.restore()
    }

    const fill = tokenFill(ctx, style, token, lineHeight)
    if (style.text.priceLayout && token.accent) {
      paintPriceGlyph(ctx, token.text, token.x, token.y, font.size, fill)
    } else {
      paintGlyph(
        ctx,
        token.text,
        token.x,
        token.y,
        fill,
        style.text.stroke,
        token.strike ? 0 : strokeWidth,
        token.strike ? undefined : style.text.outerStroke
          ? { width: style.text.outerStroke.width * strokeScale, color: style.text.outerStroke.color }
          : undefined,
      )
    }
    if (token.strike) {
      const thickness = font.size * 0.09
      ctx.strokeStyle = typeof fill === "string" ? fill : style.text.color
      ctx.lineWidth = thickness
      ctx.beginPath()
      ctx.moveTo(token.x, token.y)
      ctx.lineTo(token.x + token.width, token.y)
      ctx.stroke()
    }
    ctx.filter = "none"
    ctx.restore()
  }

  if (style.text.underline && plan.tokens.length > 0) {
    const lastY = Math.max(...plan.tokens.map((token) => token.y))
    const lineTokens = plan.tokens.filter((token) => token.y === lastY)
    const minX = Math.min(...lineTokens.map((token) => token.x))
    const maxX = Math.max(...lineTokens.map((token) => token.x + token.width))
    ctx.strokeStyle = style.text.accent || style.text.highlight.color
    ctx.lineWidth = 3 * strokeScale
    ctx.beginPath()
    ctx.moveTo(minX, lastY + lineHeight / 2 + 6 * strokeScale)
    ctx.lineTo(maxX, lastY + lineHeight / 2 + 6 * strokeScale)
    ctx.stroke()
  }

  if (style.text.highlight.mode === "karaoke-fill") {
    for (const group of groupByWord(plan.tokens)) {
      const first = group[0]
      if (!first || first.karaoke === null || first.karaoke <= 0) continue
      const minX = Math.min(...group.map((token) => token.x))
      const maxX = Math.max(...group.map((token) => token.x + token.width))
      const y = first.y
      ctx.save()
      if (perTokenPose) {
        const cx = minX + (maxX - minX) / 2
        applyPose(ctx, { ...first.pose, scale: first.pose.scale * first.scale }, cx, y, {
          ...poseHint,
          box: { w: maxX - minX, h: lineHeight },
        })
      }
      ctx.beginPath()
      ctx.rect(minX, y - lineHeight / 2, (maxX - minX) * first.karaoke, lineHeight)
      ctx.clip()
      for (const token of group) {
        ctx.fillStyle = style.text.highlight.color
        ctx.fillText(token.text, token.x, token.y)
      }
      ctx.restore()
    }
  }

  if (blockUnit) ctx.restore()
  ctx.restore()
}

/** Insert com fonte, tamanho, posição e caixa do estilo resolvido — base do layout pintado. */
export function resolvedTextInsertForPlay(
  insert: CompositionInsert,
  painted: InsertStyle,
  brandFontId: string,
): CompositionInsert {
  const fontId = parseFontId(painted.text.fontFamily) ?? parseFontId(brandFontId) ?? "geist"
  const fontWeight = clampFontWeight(fontId, painted.text.fontWeight as FontWeight)
  const upper = painted.text.textTransform === "uppercase"
  return {
    ...insert,
    text: upper ? (insert.text ?? "").toLocaleUpperCase("pt-BR") : insert.text,
    x: painted.text.x,
    y: painted.text.y,
    fontSize: painted.text.fontSize,
    maxWidthPct: painted.text.maxWidth,
    fontFamily: fontId,
    style: {
      fontFamily: fontId,
      fontWeight,
      uppercase: false,
      color: painted.text.color,
      bgColor: painted.text.background.enabled ? painted.text.background.color : null,
      strokeWidth: painted.text.stroke.enabled ? painted.text.stroke.width : 0,
      strokeColor: painted.text.stroke.color,
      shadow: "none",
      opacity: painted.text.opacity / 100,
      rotation: painted.text.rotation,
    },
  }
}

export type InsertPaintContext = {
  productData?: ProductData
  brandKitId?: string
  editPreview?: boolean
  trimStart?: number
}

export function drawResolvedInsertText(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  paintedInput: InsertStyle,
  time: number,
  frame: { width: number; height: number },
  brandFontId: string,
  fps: number,
  skipEnter = false,
  paintContext?: InsertPaintContext,
): void {
  const painted = resolveStyleColors(paintedInput, brandKitOf(paintContext?.brandKitId))
  const marked = Boolean(offerStylePatch(insert.styleRef?.presetId)) || /[*~{]/.test(insert.text ?? "")
  if (marked && insert.kind !== "caption") {
    const rawPct = Number.isFinite(painted.text.maxWidth) ? painted.text.maxWidth : PAINT_MAX_WIDTH_PCT
    const pct = Math.min(PAINT_MAX_WIDTH_PCT, Math.max(20, rawPct))
    const maxWidth = (pct / 100) * frame.width
    ctx.save()
    paintMarkedInsert(ctx, {
      text: insert.text ?? "",
      style: painted,
      maxWidth,
      measure: (text, font) => {
        const italic = font.italic ? "italic " : ""
        ctx.font = `${italic}${font.weight} ${font.size}px "${font.family}"`
        if ("letterSpacing" in ctx) {
          ctx.letterSpacing = font.letterSpacing ? `${font.letterSpacing * font.size}px` : "0px"
        }
        return ctx.measureText(text).width
      },
      origin: {
        cx: (painted.text.x / 100) * frame.width,
        cy: (painted.text.y / 100) * frame.height,
      },
      productData: paintContext?.productData,
      editPreview: paintContext?.editPreview,
      brandKitId: paintContext?.brandKitId,
      motion: skipEnter
        ? undefined
        : {
            time,
            fps,
            start: insert.start,
            duration: insert.duration,
            seed: insert.id,
            trimStart: paintContext?.trimStart ?? 0,
          },
    })
    ctx.restore()
    return
  }
  const prepared = displayRuns(insert.text ?? "", paintContext?.productData, {
    stripEmpty: !paintContext?.editPreview,
    uppercase: painted.text.textTransform === "uppercase",
  })
  const forLayout = {
    ...painted,
    text: { ...painted.text, textTransform: "none" as const },
  }
  const display = resolvedTextInsertForPlay({ ...insert, text: prepared.plain }, forLayout, brandFontId)
  const layer = resolveLayerStyle(display, brandFontId)
  const layout = layoutInsertText(
    display,
    brandFontId,
    frame,
    canvasTextMeasure(ctx, layer.fontWeight, layer.fontFamily),
    { breakWords: false },
  )
  if (!layout) return
  const spans = prepared.spans

  const words = toAbsoluteCaptionWords(insert.words ?? [], insert.start, insert.duration)
  const lineHeight = layout.effectiveFontSize * layer.lineHeight
  const strokeScale = layout.effectiveFontSize / Math.max(1, painted.text.fontSize)
  ctx.save()
  ctx.font = `${layer.fontWeight} ${layout.effectiveFontSize}px ${layer.fontFamily}`
  const measure = (value: string) => ctx.measureText(value).width
  const plan = planStyledTextDraw({
    lines: layout.lines,
    words,
    style: {
      ...painted,
      text: {
        ...painted.text,
        background: {
          ...painted.text.background,
          paddingX: painted.text.background.paddingX * strokeScale,
          paddingY: painted.text.background.paddingY * strokeScale,
          radius: painted.text.background.radius * strokeScale,
        },
      },
    },
    time,
    measure,
    lineHeight,
    blockW: layout.blockW,
    blockH: layout.blockH,
    spaceWidth: measure(" "),
    fps: fps > 0 ? fps : DEFAULT_FPS,
    cardStart: insert.start,
    cardDuration: insert.duration,
    skipEnter,
    seed: hashSeed(insert.id),
    followBackground: true,
    graphemes: true,
  })
  let cursor = 0
  const accent = painted.text.accent || painted.text.highlight.color || "#FFD400"
  for (const token of plan.tokens) {
    const at = prepared.plain.indexOf(token.text, cursor)
    const start = at < 0 ? cursor : at
    const flags = tagToken(spans, start, start + token.text.length)
    cursor = start + token.text.length
    if (flags.accent) {
      token.accent = true
      token.fill = accent
    }
    if (flags.strike) token.strike = true
    if (flags.missing) {
      token.missing = true
      token.boxColor = "#F6E27A"
    }
  }
  ctx.restore()

  warnInvisibleCaptionPaint({
    id: insert.id,
    preset: insert.styleRef?.presetId,
    blockW: layout.blockW,
    blockH: layout.blockH,
    text: insert.text ?? "",
    tokenCount: plan.tokens.length,
    visibleGlyphs: visibleGlyphCount(plan),
    words: words.length,
  })

  paintStyledTextPlan(
    ctx,
    plan,
    painted,
    { cx: layout.cx, cy: layout.cy },
    {
      family: canvasFontFamily(painted.text.fontFamily) || layer.fontFamily,
      weight: painted.text.fontWeight,
      size: layout.effectiveFontSize,
    },
    lineHeight,
    strokeScale,
  )
}

