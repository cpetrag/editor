import type { CompositionInsert } from "../composition.ts"
import type { ProductData } from "../content/runs.ts"
import { offerStylePatch } from "../style/offer-styles.ts"
import { resolveInsertStyle } from "../style/resolve-insert-style.ts"
import { layoutMarkedText } from "../paint/layout.ts"
import { PLAY_H, PLAY_W } from "./layout.ts"
import { resolveLayerStyle } from "./resolve-style.ts"
import { wrapLines } from "./wrap-lines.ts"

export const TEXT_OVERFLOW_TOOLTIP =
  "O texto não cabe na largura definida — reduza a fonte ou aumente a largura máxima."

export const TEXT_SHRINK_FLOOR = 0.4
export const SELECTION_PAD_PX = 8

export interface TextLayout {
  lines: string[]
  blockW: number
  blockH: number
  effectiveFontSize: number
  overflow: boolean
  cx: number
  cy: number
  rotation: number
}

export interface TextMeasure {
  (fontSize: number, value: string): number
}

function layoutAtSize(
  text: string,
  fontSize: number,
  lineHeight: number,
  maxWidth: number,
  measureWidth: TextMeasure,
  breakWords = true,
): Omit<TextLayout, "effectiveFontSize" | "overflow" | "cx" | "cy" | "rotation"> {
  const lines = wrapLines(text, maxWidth, (value) => measureWidth(fontSize, value), breakWords)
  const lineH = fontSize * lineHeight
  const widths = lines.map((line) => measureWidth(fontSize, line))
  const blockW = Math.max(0, ...widths)
  const blockH = Math.max(lineH, lines.length * lineH)
  return { lines, blockW, blockH }
}

function overflows(layout: { blockW: number; blockH: number }, maxWidth: number, maxHeight: number): boolean {
  return layout.blockW > maxWidth + 0.5 || layout.blockH > maxHeight + 0.5
}

export function layoutTextBlock(options: {
  text: string
  maxWidth: number
  maxHeight: number
  fontSize: number
  lineHeight: number
  measureWidth: TextMeasure
  breakWords?: boolean
}): Pick<TextLayout, "lines" | "blockW" | "blockH" | "effectiveFontSize" | "overflow"> {
  const configured = Math.max(1, options.fontSize)
  const floor = Math.max(1, configured * TEXT_SHRINK_FLOOR)
  const breakWords = options.breakWords !== false
  let size = configured
  let layout = layoutAtSize(
    options.text,
    size,
    options.lineHeight,
    options.maxWidth,
    options.measureWidth,
    breakWords,
  )
  while (overflows(layout, options.maxWidth, options.maxHeight) && size > floor + 1e-6) {
    const next = Math.max(floor, size - Math.max(1, configured * 0.04))
    if (next >= size - 1e-9) break
    size = next
    layout = layoutAtSize(
      options.text,
      size,
      options.lineHeight,
      options.maxWidth,
      options.measureWidth,
      breakWords,
    )
  }
  return {
    ...layout,
    effectiveFontSize: size,
    overflow: overflows(layout, options.maxWidth, options.maxHeight),
  }
}

export function fallbackTextMeasure(fontSize: number, value: string): number {
  return value.length * fontSize * 0.55
}

export function canvasTextMeasure(
  ctx: Pick<CanvasRenderingContext2D, "font" | "measureText">,
  fontWeight: number,
  fontFamily: string,
): TextMeasure {
  return (fontSize, value) => {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    return ctx.measureText(value).width
  }
}

export function layoutInsertText(
  insert: CompositionInsert,
  brandFontId: string,
  frame: { width: number; height: number } = { width: PLAY_W, height: PLAY_H },
  measureWidth?: TextMeasure,
  options?: { breakWords?: boolean; productData?: ProductData; brandKitId?: string; editPreview?: boolean },
): TextLayout | null {
  const marked =
    insert.kind !== "caption" &&
    (Boolean(offerStylePatch(insert.styleRef?.presetId)) || /[*~{]/.test(insert.text ?? ""))
  if (marked) {
    const painted = resolveInsertStyle(insert, { frameWidth: frame.width })
    const maxW = (painted.text.maxWidth / 100) * frame.width
    const laid = layoutMarkedText({
      text: insert.text ?? "",
      style: painted,
      maxWidth: maxW,
      productData: options?.productData,
      editPreview: options?.editPreview ?? true,
      brandKitId: options?.brandKitId,
      measure: (text, font) =>
        measureWidth ? measureWidth(font.size, text) : text.length * font.size * 0.55,
    })
    return {
      lines: laid.lines.map((line) => line.pieces.map((piece) => piece.text).join(" ")),
      blockW: laid.blockW,
      blockH: laid.blockH,
      effectiveFontSize: painted.text.fontSize,
      overflow: laid.blockW > maxW + 0.5,
      cx: (painted.text.x / 100) * frame.width,
      cy: (painted.text.y / 100) * frame.height,
      rotation: painted.text.rotation || insert.rotation || 0,
    }
  }
  const style = resolveLayerStyle(insert, brandFontId)
  const raw = style.uppercase ? style.text.toUpperCase() : style.text
  if (!raw.trim()) return null
  const maxW = (style.maxWidthPct / 100) * frame.width
  const measure = measureWidth ?? fallbackTextMeasure
  const laid = layoutTextBlock({
    text: raw,
    maxWidth: maxW,
    maxHeight: frame.height,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    measureWidth: measure,
    breakWords: options?.breakWords,
  })
  return {
    ...laid,
    cx: (style.xPct / 100) * frame.width,
    cy: (style.yPct / 100) * frame.height,
    rotation: style.rotation,
  }
}
