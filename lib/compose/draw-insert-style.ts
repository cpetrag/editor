import { IDENTITY_POSE, type AnimPose } from "../style/anim-engine.ts"
import { planStyledTextDraw, type PlannedToken, type StyledTextPlan, visibleGlyphCount, warnInvisibleCaptionPaint } from "../style/caption-draw.ts"
import type { InsertStyle } from "../style/types.ts"
import type { CompositionInsert } from "../composition.ts"
import { DEFAULT_FPS } from "../composition.ts"
import { toAbsoluteCaptionWords } from "../caption-time.ts"
import { canvasFontFamily } from "./fonts.ts"
import { clampFontWeight, parseFontId, type FontWeight } from "./insert-style.ts"
import { layoutInsertText, canvasTextMeasure } from "./layout-text.ts"
import { resolveLayerStyle } from "./resolve-style.ts"

function applyPose(
  ctx: CanvasRenderingContext2D,
  pose: AnimPose,
  originX: number,
  originY: number,
): void {
  ctx.translate(originX, originY)
  ctx.translate(pose.x, pose.y)
  ctx.rotate((pose.rotate * Math.PI) / 180)
  ctx.scale(pose.scale, pose.scale)
  ctx.globalAlpha *= pose.opacity
  if (pose.blur > 0) ctx.filter = `blur(${pose.blur}px)`
  ctx.translate(-originX, -originY)
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
): void {
  if (stroke.enabled && strokeWidth > 0) {
    ctx.lineJoin = "round"
    ctx.miterLimit = 2
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = strokeWidth
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
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
  ctx.font = `${font.weight} ${font.size}px ${font.family}`
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"
  const letterSpacing = style.text.letterSpacing * font.size
  if (letterSpacing && "letterSpacing" in ctx) {
    ctx.letterSpacing = `${letterSpacing}px`
  }

  const blockUnit = style.animation.unit === "bloco"
  const blockPose = blockUnit ? (plan.tokens[0]?.pose ?? IDENTITY_POSE) : IDENTITY_POSE
  if (blockUnit) {
    ctx.save()
    applyPose(ctx, blockPose, 0, 0)
  }

  if (style.text.background.enabled && style.text.background.mode !== "por-palavra") {
    ctx.save()
    ctx.globalAlpha *= Math.max(0, Math.min(1, style.text.background.opacity / 100))
    ctx.fillStyle = style.text.background.color
    for (const rect of plan.backgrounds) {
      fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.r)
    }
    ctx.restore()
  }

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
    applyPose(ctx, pose, cx, cy)

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

    for (const shadow of style.text.shadows) {
      ctx.save()
      ctx.shadowOffsetX = shadow.x * strokeScale
      ctx.shadowOffsetY = shadow.y * strokeScale
      ctx.shadowBlur = shadow.blur * strokeScale
      ctx.shadowColor = shadow.color
      ctx.fillStyle = token.fill
      ctx.fillText(token.text, token.x, token.y)
      ctx.restore()
    }

    paintGlyph(
      ctx,
      token.text,
      token.x,
      token.y,
      tokenFill(ctx, style, token, lineHeight),
      style.text.stroke,
      strokeWidth,
    )
    ctx.restore()
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
        applyPose(
          ctx,
          { ...first.pose, scale: first.pose.scale * first.scale },
          cx,
          y,
        )
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

export function drawResolvedInsertText(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  painted: InsertStyle,
  time: number,
  frame: { width: number; height: number },
  brandFontId: string,
  fps: number,
  skipEnter = false,
): void {
  const fontId = parseFontId(painted.text.fontFamily) ?? parseFontId(brandFontId) ?? "geist"
  const fontWeight = clampFontWeight(fontId, painted.text.fontWeight as FontWeight)
  const upper = painted.text.textTransform === "uppercase"
  const display: CompositionInsert = {
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
  const layer = resolveLayerStyle(display, brandFontId)
  const layout = layoutInsertText(
    display,
    brandFontId,
    frame,
    canvasTextMeasure(ctx, layer.fontWeight, layer.fontFamily),
  )
  if (!layout) return

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
  })
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

