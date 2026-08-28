import type { CompositionInsert, OverlayTextAlign } from "../composition.ts"
import {
  DEFAULT_MAX_WIDTH_PCT,
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_TEXT_PRESET,
  DEFAULT_TEXT_X,
  DEFAULT_TEXT_Y,
  insertKind,
  TEXT_DRAW_Y_MAX,
  TEXT_DRAW_Y_MIN,
} from "../composition.ts"
import {
  resolveInsertStyle as resolveSharedInsertStyle,
  toComposeInsertStyle,
} from "../style/resolve-insert-style.ts"
import { isTextPresetId } from "../text-presets/catalog.ts"
import { canvasFontFamily } from "./fonts.ts"
import { presetPaint } from "./presets.ts"
import { resolveInsertStyle } from "./insert-style.ts"
import type { ShadowPreset } from "./insert-style.ts"

export interface ResolvedTextStyle {
  text: string
  xPct: number
  yPct: number
  fontSize: number
  fontFamily: string
  fontWeight: number
  color: string
  uppercase: boolean
  lineHeight: number
  maxWidthPct: number
  textAlign: OverlayTextAlign
  rotation: number
  opacity: number
  shadow: ShadowPreset
  bgColor?: string
  bgOpacity?: number
  pillRadius?: number
  stroke?: { width: number; color: string }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function resolveLayerStyle(
  insert: CompositionInsert,
  brandFontId: string,
): ResolvedTextStyle {
  const source =
    insertKind(insert) === "text" &&
    (isTextPresetId(insert.preset) || Boolean(insert.styleRef))
      ? {
          ...insert,
          style: toComposeInsertStyle(resolveSharedInsertStyle(insert, { frameWidth: 1080 })),
        }
      : insert
  const paint = presetPaint(source.preset ?? DEFAULT_TEXT_PRESET)
  const styled = source.style ? resolveInsertStyle(source, brandFontId) : null
  const fontId = styled?.fontFamily ?? source.fontFamily ?? brandFontId
  const color = styled?.color ?? paint.color
  const fontWeight = styled?.fontWeight ?? paint.fontWeight ?? 800
  const uppercase = styled ? styled.uppercase : paint.uppercase === true
  const rotation = styled ? styled.rotation : (source.rotation ?? 0)
  const bgColor = styled ? styled.bgColor : paint.bgColor
  const stroke =
    styled
      ? styled.strokeWidth > 0
        ? { width: styled.strokeWidth, color: styled.strokeColor }
        : undefined
      : paint.stroke
  return {
    text: source.text ?? "",
    xPct: source.x ?? DEFAULT_TEXT_X,
    yPct: clamp(source.y ?? DEFAULT_TEXT_Y, TEXT_DRAW_Y_MIN, TEXT_DRAW_Y_MAX),
    fontSize: source.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
    fontFamily: canvasFontFamily(fontId),
    fontWeight,
    color,
    uppercase,
    lineHeight: 1.2,
    maxWidthPct: source.maxWidthPct ?? DEFAULT_MAX_WIDTH_PCT,
    textAlign: source.textAlign ?? "center",
    rotation,
    opacity: styled?.opacity ?? 1,
    shadow: styled?.shadow ?? "none",
    ...(bgColor
      ? {
          bgColor,
          bgOpacity: styled ? 1 : paint.bgOpacity,
          pillRadius: styled ? 8 : (paint.pillRadius ?? 8),
        }
      : {}),
    ...(stroke ? { stroke } : {}),
  }
}
