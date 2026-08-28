import type { CaptionPreset, CaptionStyle, CompositionInsert } from "../composition.ts"
import { DEFAULT_FPS, insertKind } from "../composition.ts"
import { toAbsoluteCaptionWords } from "../caption-time.ts"
import { resolveCaptionInsertStyle } from "../style/caption-map.ts"
import { planStyledTextDraw, visibleGlyphCount, warnInvisibleCaptionPaint } from "../style/caption-draw.ts"
import { trackStyleForInsert } from "../style-preset.ts"
import type { StyleLayer, TrackId, UserPreset } from "../style/types.ts"
import { PLAY_H, PLAY_W } from "./layout.ts"
import { canvasTextMeasure, layoutInsertText } from "./layout-text.ts"
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

export function drawCaptionInserts(
  ctx: CanvasRenderingContext2D,
  inserts: CompositionInsert[],
  time: number,
  preset: CaptionPreset,
  brandFontId: string,
  style: CaptionStyle,
  context?: PlayStyleContext,
): void {
  for (const insert of inserts) {
    drawCaptionLine(ctx, insert, time, preset, brandFontId, style, context)
  }
}
