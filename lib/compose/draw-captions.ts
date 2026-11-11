import type { BrandColors } from "../brand/kits.ts"
import type { ProductData } from "../content/runs.ts"
import type { CaptionPreset, CaptionStyle, CompositionInsert } from "../composition.ts"
import { DEFAULT_FPS, insertKind } from "../composition.ts"
import { toAbsoluteCaptionWords } from "../caption-time.ts"
import { resolveCaptionInsertStyle } from "../style/caption-map.ts"
import { planStyledTextDraw, visibleGlyphCount, warnInvisibleCaptionPaint } from "../style/caption-draw.ts"
import { trackStyleForInsert } from "../style-preset.ts"
import type { StyleLayer, TrackId, UserPreset } from "../style/types.ts"
import { PLAY_H, PLAY_W } from "./layout.ts"
import { canvasTextMeasure, layoutInsertText } from "./layout-text.ts"
import { dodgeCaptionTop, dodgeOffsetAt, visualBounds, type CaptionBox } from "../caption-dodge.ts"
import { resolvedTextInsertForPlay } from "./draw-insert-style.ts"
import { resolveInsertStyle } from "../style/resolve-insert-style.ts"
import { resolveStyle } from "../style/resolve-style.ts"
import { canvasFontFamily } from "./fonts.ts"
import { resolveLayerStyle } from "./resolve-style.ts"
import { paintStyledTextPlan } from "./draw-insert-style.ts"
import { captionInsertForPlay } from "./caption-layout.ts"

export type PlayStyleContext = {
  project?: StyleLayer
  tracks?: Partial<Record<TrackId, StyleLayer>>
  videoDuration?: number
  fps?: number
  customPresets?: UserPreset[]
  /** Editor overlay: skip enter fade so glyphs stay visible while scrubbing/editing. */
  editPreview?: boolean
  productData?: ProductData
  brandKitId?: string
  brandColors?: BrandColors
  trimStart?: number
  /** Desvio vertical em relação aos inserts. Padrão ligado. */
  dodgeInserts?: boolean
}

function isActive(insert: CompositionInsert, time: number): boolean {
  return time >= insert.start && time < insert.start + insert.duration
}

function trackForInsert(
  insert: CompositionInsert,
  context: PlayStyleContext | undefined,
): StyleLayer | null {
  if (context?.videoDuration == null) return null
  return trackStyleForInsert(insert, context.tracks, context.videoDuration)
}

export function drawCaptionLine(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  time: number,
  preset: CaptionPreset,
  brandFontId: string,
  style: CaptionStyle,
  context?: PlayStyleContext,
  yOffset = 0,
): void {
  if (insertKind(insert) !== "caption") return
  if (!isActive(insert, time)) return

  const painted = resolveCaptionInsertStyle(
    insert,
    style,
    preset,
    trackForInsert(insert, context),
    context?.project ?? {},
  )
  const display = captionInsertForPlay(insert, painted)
  const layer = resolveLayerStyle(display, brandFontId)
  const layout = layoutInsertText(
    display,
    brandFontId,
    { width: PLAY_W, height: PLAY_H },
    canvasTextMeasure(ctx, layer.fontWeight, layer.fontFamily),
  )
  if (!layout) return

  const words = toAbsoluteCaptionWords(insert.words ?? [], insert.start, insert.duration)
  const lineHeight = layout.effectiveFontSize * layer.lineHeight
  const strokeScale = layout.effectiveFontSize / Math.max(1, painted.text.fontSize)
  const measure = (value: string) => ctx.measureText(value).width
  ctx.save()
  ctx.font = `${layer.fontWeight} ${layout.effectiveFontSize}px ${layer.fontFamily}`
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
    fps: context?.fps && context.fps > 0 ? context.fps : DEFAULT_FPS,
    cardStart: insert.start,
    cardDuration: insert.duration,
    skipEnter: context?.editPreview === true,
  })
  ctx.restore()

  warnInvisibleCaptionPaint({
    id: insert.id,
    preset: insert.styleRef?.presetId ?? preset,
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
    { cx: layout.cx, cy: layout.cy + yOffset },
    {
      family: canvasFontFamily(painted.text.fontFamily) || layer.fontFamily,
      weight: painted.text.fontWeight,
      size: layout.effectiveFontSize,
    },
    lineHeight,
    strokeScale,
  )
}

export function drawCaptionInserts(
  ctx: CanvasRenderingContext2D,
  inserts: CompositionInsert[],
  time: number,
  preset: CaptionPreset,
  brandFontId: string,
  style: CaptionStyle,
  context?: PlayStyleContext,
): void {
  const dodge = context?.dodgeInserts !== false
  const offsets = dodge ? captionDodgeOffsets(ctx, inserts, brandFontId, style, preset, context) : new Map<string, number>()
  for (const insert of inserts) {
    const delta = offsets.get(insert.id) ?? 0
    const animated = delta === 0 ? 0 : dodgeOffsetAt(time, insert.start, delta)
    drawCaptionLine(ctx, insert, time, preset, brandFontId, style, context, animated)
  }
}

function insertBox(
  ctx: CanvasRenderingContext2D,
  insert: CompositionInsert,
  brandFontId: string,
  context?: PlayStyleContext,
): CaptionBox | null {
  if (insertKind(insert) === "caption") return null
  const track = trackForInsert(insert, context)
  const project = context?.project ?? {}
  const painted =
    insert.styleRef || insert.preset
      ? resolveInsertStyle(insert, {
          project,
          track,
          frameWidth: PLAY_W,
        })
      : resolveStyle(insert, track, project)
  const display = resolvedTextInsertForPlay(insert, painted, brandFontId)
  const layer = resolveLayerStyle(display, brandFontId)
  const layout = layoutInsertText(
    display,
    brandFontId,
    { width: PLAY_W, height: PLAY_H },
    canvasTextMeasure(ctx, layer.fontWeight, layer.fontFamily),
  )
  if (!layout) {
    if (insertKind(insert) !== "sticker" && insertKind(insert) !== "chip") return null
    const scale = insert.scale && insert.scale > 0 ? insert.scale : 1
    const size = 280 * scale
    const cx = ((insert.x ?? 50) / 100) * PLAY_W
    const cy = ((insert.y ?? 50) / 100) * PLAY_H
    return visualBounds({ cx, cy, width: size, height: size, rotation: insert.rotation ?? 0 })
  }
  const scale = layout.effectiveFontSize / Math.max(1, painted.text.fontSize)
  const padX = painted.text.background.enabled ? painted.text.background.paddingX * scale : 0
  const padY = painted.text.background.enabled ? painted.text.background.paddingY * scale : 0
  return visualBounds({
    cx: layout.cx,
    cy: layout.cy,
    width: layout.blockW + padX * 2,
    height: layout.blockH + padY * 2,
    rotation: painted.text.rotation || insert.rotation || 0,
  })
}

function captionDodgeOffsets(
  ctx: CanvasRenderingContext2D,
  inserts: CompositionInsert[],
  brandFontId: string,
  style: CaptionStyle,
  preset: CaptionPreset,
  context?: PlayStyleContext,
): Map<string, number> {
  const offsets = new Map<string, number>()
  const safeTop = PLAY_H * 0.06
  const safeBottom = PLAY_H * 0.94
  const obstacles = new Map<string, CaptionBox>()
  for (const insert of inserts) {
    if (insertKind(insert) === "caption") continue
    const box = insertBox(ctx, insert, brandFontId, context)
    if (box) obstacles.set(insert.id, box)
  }
  for (const insert of inserts) {
    if (insertKind(insert) !== "caption") continue
    const painted = resolveCaptionInsertStyle(
      insert,
      style,
      preset,
      trackForInsert(insert, context),
      context?.project ?? {},
    )
    const display = captionInsertForPlay(insert, painted)
    const layer = resolveLayerStyle(display, brandFontId)
    const layout = layoutInsertText(
      display,
      brandFontId,
      { width: PLAY_W, height: PLAY_H },
      canvasTextMeasure(ctx, layer.fontWeight, layer.fontFamily),
    )
    if (!layout) continue
    const scale = layout.effectiveFontSize / Math.max(1, painted.text.fontSize)
    const padX = painted.text.background.enabled ? painted.text.background.paddingX * scale : 0
    const padY = painted.text.background.enabled ? painted.text.background.paddingY * scale : 0
    const captionBox = visualBounds({
      cx: layout.cx,
      cy: layout.cy,
      width: layout.blockW + padX * 2,
      height: layout.blockH + padY * 2,
      rotation: painted.text.rotation,
    })
    const blockers: CaptionBox[] = []
    for (const other of inserts) {
      if (other.id === insert.id || insertKind(other) === "caption") continue
      const overlaps =
        other.start < insert.start + insert.duration - 1e-3 && insert.start < other.start + other.duration - 1e-3
      if (!overlaps) continue
      const box = obstacles.get(other.id)
      if (box) blockers.push(box)
    }
    const top = dodgeCaptionTop({
      caption: captionBox,
      obstacles: blockers,
      safeTop,
      safeBottom,
    })
    offsets.set(insert.id, top - captionBox.top)
  }
  return offsets
}
