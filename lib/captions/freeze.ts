import { DEFAULT_CAPTION_STYLE } from "../composition.ts"
import { captionStyleToInsertStyle } from "../style/caption-map.ts"
import { PRESETS } from "../style/presets.ts"
import type { InsertStyle } from "../style/types.ts"

export const CAPTION_REGRESSION_LOOKS = [
  "limpo",
  "viral",
  "hormozi",
  "karaoke",
  "umaPalavra",
  "pillBranca",
  "marcador",
  "tiktokNativo",
  "neon",
  "minimal",
] as const

export type CaptionRegressionLook = (typeof CAPTION_REGRESSION_LOOKS)[number]

export function freezeCaptionStyle(style: InsertStyle) {
  return {
    fontFamily: style.text.fontFamily,
    fontWeight: style.text.fontWeight,
    fontSize: style.text.fontSize,
    letterSpacing: style.text.letterSpacing,
    lineHeight: style.text.lineHeight,
    textTransform: style.text.textTransform,
    textAlign: style.text.textAlign,
    maxWidth: style.text.maxWidth,
    color: style.text.color,
    stroke: style.text.stroke,
    shadows: style.text.shadows,
    background: style.text.background,
    highlight: style.text.highlight,
    animation: {
      unit: style.animation.unit,
      enterFrom: style.animation.enter.from,
      enterDuration: style.animation.enter.durationInFrames,
      enterEasing: style.animation.enter.easing,
      stagger: style.animation.enter.staggerInFrames,
    },
  }
}

export function captionLookStyle(id: CaptionRegressionLook): InsertStyle {
  if (id === "limpo" || id === "viral") {
    return captionStyleToInsertStyle(DEFAULT_CAPTION_STYLE, id)
  }
  const preset = PRESETS[id]
  if (!preset) throw new Error(`preset de legenda ausente: ${id}`)
  return preset.style
}

export function freezeCaptionLooks(): Record<CaptionRegressionLook, ReturnType<typeof freezeCaptionStyle>> {
  const out = {} as Record<CaptionRegressionLook, ReturnType<typeof freezeCaptionStyle>>
  for (const id of CAPTION_REGRESSION_LOOKS) {
    out[id] = freezeCaptionStyle(captionLookStyle(id))
  }
  return out
}
