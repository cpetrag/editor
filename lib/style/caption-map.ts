import { deepMerge } from "./deep-merge.ts"
import { LEGADO_PRESET_ID, LEGADO_STYLE } from "./presets.ts"
import { resolveStyle } from "./resolve-style.ts"
import type { DeepPartial, InsertStyle, StyleLayer, TextStyle } from "./types.ts"

export type CaptionPaintInput = {
  x: number
  y: number
  fontSize: number
  maxWidthPct: number
  fontFamily: string
  fontWeight: number
  color: string
  highlightColor: string
  bgColor: string
  strokeColor: string
  strokeWidth: number
  rotation?: number
}

export type CaptionPaintPreset = "viral" | "limpo"

function captionSafeOverrides(
  overrides: DeepPartial<InsertStyle> | undefined,
): DeepPartial<InsertStyle> | undefined {
  if (!overrides) return undefined
  const text = overrides.text
  const nextText: DeepPartial<TextStyle> = {}
  if (text?.highlight) nextText.highlight = text.highlight
  if (text?.background) nextText.background = text.background
  if (text?.gradient) nextText.gradient = text.gradient
  if (text?.shadows) nextText.shadows = text.shadows
  if (text?.stroke) nextText.stroke = text.stroke
  const hasText = Object.keys(nextText).length > 0
  if (!overrides.animation && !hasText) return undefined
  return {
    ...(overrides.animation ? { animation: overrides.animation } : {}),
    ...(hasText ? { text: nextText } : {}),
  }
}

export function captionStyleToInsertStyle(
  style: CaptionPaintInput,
  preset: CaptionPaintPreset,
): InsertStyle {
  const viral = preset === "viral"
  const limpo = preset === "limpo"
  return {
    text: {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      letterSpacing: 0,
      lineHeight: 1.2,
      textTransform: viral ? "uppercase" : "none",
      textAlign: "center",
      maxWidth: style.maxWidthPct,
      color: style.color,
      gradient: { enabled: false, from: "#fff", to: "#fff", angle: 0 },
      stroke: {
        enabled: viral && style.strokeWidth > 0,
        width: style.strokeWidth,
        color: style.strokeColor,
      },
      shadows: [],
      background: {
        enabled: limpo,
        mode: "bloco",
        color: style.bgColor,
        opacity: limpo ? 100 : 0,
        paddingX: style.fontSize * 0.4,
        paddingY: style.fontSize * 0.22,
        radius: 8,
        backdropBlur: 0,
      },
      highlight: {
        mode: "palavra-ativa",
        color: style.highlightColor,
        boxColor: null,
        scale: 1,
        keywords: [],
      },
      x: style.x,
      y: style.y,
      rotation: style.rotation ?? 0,
      opacity: 100,
    },
    animation: {
      unit: LEGADO_STYLE.animation.unit,
      enter: { ...LEGADO_STYLE.animation.enter, from: { ...LEGADO_STYLE.animation.enter.from } },
      exit: { ...LEGADO_STYLE.animation.exit, to: { ...LEGADO_STYLE.animation.exit.to } },
      loop: { ...LEGADO_STYLE.animation.loop },
    },
  }
}

export function resolveCaptionInsertStyle(
  insert: StyleLayer,
  caption: CaptionPaintInput,
  preset: CaptionPaintPreset,
  track: StyleLayer | null,
  project: StyleLayer,
): InsertStyle {
  const mapped = captionStyleToInsertStyle(caption, preset)
  const ref = insert.styleRef ?? track?.styleRef ?? project.styleRef
  if (ref && ref.presetId !== LEGADO_PRESET_ID) {
    return resolveStyle(insert, track, project)
  }
  return deepMerge(
    mapped,
    captionSafeOverrides(project.styleRef?.overrides),
    captionSafeOverrides(track?.styleRef?.overrides),
    captionSafeOverrides(insert.styleRef?.overrides),
  )
}
