import type { CaptionPreset, CaptionStyle, CompositionInsert } from "../composition.ts"
import { insertKind } from "../composition.ts"
import { resolveCaptionInsertStyle } from "../style/caption-map.ts"
import { LEGADO_PRESET_ID } from "../style/presets.ts"
import { resolveInsertStyle } from "../style/resolve-insert-style.ts"
import { resolveStyle } from "../style/resolve-style.ts"
import type { InsertStyle, StyleLayer } from "../style/types.ts"
import { isTextPresetId } from "../text-presets/catalog.ts"
import { resolvedTextInsertForPlay } from "./draw-insert-style.ts"
import { paintBrandKit, type BrandColors } from "../brand/kits.ts"
import { resolveStyleColors } from "../brand/resolve-style-colors.ts"
import { canvasFontFamily } from "./fonts.ts"
import { canvasShadow } from "./insert-style.ts"
import type { TextLayout } from "./layout-text.ts"
import { PLAY_H, PLAY_W } from "./layout.ts"
import { resolveLayerStyle } from "./resolve-style.ts"

export type InlineEditorCss = {
  fontFamily: string
  fontWeight: number
  fontSize: number
  lineHeight: number
  letterSpacing: string
  textTransform: "none" | "uppercase"
  textAlign: "left" | "center" | "right"
  color: string
  caretColor: string
  maxWidth: number
  padding: string
  borderRadius: string
  backgroundColor?: string
  WebkitTextStroke?: string
  paintOrder?: string
  textShadow?: string
  accentColor?: string
}

export type InlineEditorPlacement = {
  /** Centro do bloco de texto, em px relativos ao host do palco. */
  centerX: number
  centerY: number
  rotation: number
}

/**
 * Estilo que o canvas usa para pintar este texto. Segue os mesmos ramos de
 * `drawOverlayInserts` (texto) e `drawCaptionLine` (legenda); `null` = pintura legada.
 */
export function paintedTextStyleFor(
  insert: CompositionInsert,
  context: {
    captionStyle: CaptionStyle
    captionPreset: CaptionPreset
    track: StyleLayer | null
    project: StyleLayer
  },
): InsertStyle | null {
  const kind = insertKind(insert)
  if (kind === "caption") {
    return resolveCaptionInsertStyle(
      insert,
      context.captionStyle,
      context.captionPreset,
      context.track,
      context.project,
    )
  }
  if (kind !== "text") return null
  if (isTextPresetId(insert.preset) || insert.styleRef) {
    return resolveInsertStyle(insert, {
      project: context.project,
      track: context.track,
      frameWidth: PLAY_W,
    })
  }
  const ref = insert.styleRef ?? context.track?.styleRef ?? context.project.styleRef
  if (ref && ref.presetId !== LEGADO_PRESET_ID) {
    return resolveStyle(insert, context.track, context.project)
  }
  return null
}

/**
 * Insert que o canvas realmente mede para pintar o texto. Texto com estilo resolvido
 * usa tamanho/posição/caixa do preset; legenda e texto legado já vêm prontos em `laidOut`.
 */
export function paintedDisplayInsert(input: {
  insert: CompositionInsert
  laidOut: CompositionInsert
  painted: InsertStyle | null
  brandFontId: string
}): CompositionInsert {
  const { insert, laidOut, painted, brandFontId } = input
  if (!painted || insertKind(insert) !== "text") return laidOut
  return resolvedTextInsertForPlay(insert, painted, brandFontId)
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`
}

function withOpacity(color: string, opacityPct: number): string {
  const pct = Math.max(0, Math.min(100, opacityPct))
  if (pct >= 100) return color
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

function visibleColor(color: string | undefined): string {
  if (!color || color === "transparent") return "#ffffff"
  return color
}

/**
 * CSS do editor inline em px de tela. `scale` = largura do preview / 1080, então
 * fonte, padding, contorno e raio acompanham o tamanho do palco.
 */
export function inlineEditorCss(input: {
  laidOut: CompositionInsert
  layout: TextLayout
  painted: InsertStyle | null
  brandFontId: string
  scale: number
  brandKitId?: string
  brandColors?: BrandColors
}): InlineEditorCss {
  const { laidOut, layout, brandFontId, scale } = input
  const painted = input.painted
    ? resolveStyleColors(
        input.painted,
        paintBrandKit({
          brandKitId: input.brandKitId,
          brandColors: input.brandColors,
          paletteOverride: laidOut.paletteOverride,
        }),
      )
    : null
  const layer = resolveLayerStyle(laidOut, brandFontId)
  const size = layout.effectiveFontSize
  const maxWidth = ((layer.maxWidthPct / 100) * PLAY_W) * scale

  if (painted) {
    const text = painted.text
    const strokeScale = size / Math.max(1, text.fontSize)
    const unit = strokeScale * scale
    const css: InlineEditorCss = {
      fontFamily: canvasFontFamily(text.fontFamily) || layer.fontFamily,
      fontWeight: text.fontWeight,
      fontSize: size * scale,
      lineHeight: layer.lineHeight,
      letterSpacing: px(text.letterSpacing * size * scale),
      textTransform: text.textTransform,
      textAlign: text.textAlign,
      color: visibleColor(text.color),
      caretColor: "#38bdf8",
      accentColor: text.accent || text.highlight.color || "#FFD400",
      maxWidth,
      padding: "0px",
      borderRadius: "0px",
    }
    if (text.stroke.enabled && text.stroke.width > 0) {
      css.WebkitTextStroke = `${px(text.stroke.width * unit)} ${text.stroke.color}`
      css.paintOrder = "stroke fill"
    }
    if (text.shadows.length > 0) {
      css.textShadow = text.shadows
        .map((shadow) => `${px(shadow.x * unit)} ${px(shadow.y * unit)} ${px(shadow.blur * unit)} ${shadow.color}`)
        .join(", ")
    }
    if (text.background.enabled) {
      css.backgroundColor = withOpacity(text.background.color, text.background.opacity)
      css.padding = `${px(text.background.paddingY * unit)} ${px(text.background.paddingX * unit)}`
      css.borderRadius = px(text.background.radius * unit)
    }
    return css
  }

  const strokeScale = size / Math.max(1, layer.fontSize)
  const css: InlineEditorCss = {
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    fontSize: size * scale,
    lineHeight: layer.lineHeight,
    letterSpacing: "0px",
    textTransform: layer.uppercase ? "uppercase" : "none",
    textAlign: layer.textAlign,
    color: visibleColor(layer.color),
    caretColor: "#38bdf8",
    maxWidth,
    padding: "0px",
    borderRadius: "0px",
  }
  if (layer.stroke) {
    css.WebkitTextStroke = `${px(layer.stroke.width * strokeScale * scale)} ${layer.stroke.color}`
    css.paintOrder = "stroke fill"
  }
  const shadow = canvasShadow(layer.shadow, layer.color)
  if (shadow) {
    css.textShadow = `${px(shadow.offsetX * scale)} ${px(shadow.offsetY * scale)} ${px(shadow.blur * scale)} ${shadow.color}`
  }
  if (layer.bgColor) {
    css.backgroundColor = withOpacity(layer.bgColor, (layer.bgOpacity ?? 1) * 100)
    css.padding = `${px(size * 0.22 * scale)} ${px(size * 0.4 * scale)}`
    css.borderRadius =
      layer.pillRadius === 999 ? "9999px" : px((layer.pillRadius ?? 8) * strokeScale * scale)
  }
  return css
}

/** Layout usado quando o texto está vazio (o canvas não gera layout para texto vazio). */
export function fallbackTextLayout(laidOut: CompositionInsert, brandFontId: string): TextLayout {
  const layer = resolveLayerStyle(laidOut, brandFontId)
  return {
    lines: [""],
    blockW: 0,
    blockH: layer.fontSize * layer.lineHeight,
    effectiveFontSize: layer.fontSize,
    overflow: false,
    cx: (layer.xPct / 100) * PLAY_W,
    cy: (layer.yPct / 100) * PLAY_H,
    rotation: layer.rotation,
  }
}

export function inlineEditorPlacement(
  layout: TextLayout,
  metrics: { displayScale: number; ox: number; oy: number },
  host: { left: number; top: number },
): InlineEditorPlacement {
  return {
    centerX: metrics.ox - host.left + layout.cx * metrics.displayScale,
    centerY: metrics.oy - host.top + layout.cy * metrics.displayScale,
    rotation: layout.rotation,
  }
}

/** Conteúdo de um texto criado por duplo clique em área vazia do palco. */
export const DEFAULT_INLINE_TEXT = "Texto"

/** Texto final de uma edição inline: vazio (só espaços) vira `null` = remover o insert. */
export function committedInlineText(text: string): string | null {
  return text.trim() ? text : null
}
