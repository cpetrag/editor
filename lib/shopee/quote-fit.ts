import { FONT_SIZE_MIN, type CompositionInsert } from "../composition.ts"
import { fallbackTextMeasure } from "../compose/layout-text.ts"
import { wrapLines } from "../compose/wrap-lines.ts"

const FRAME_W = 1080
const FRAME_H = 1920
const SAFE_TOP = 12
const SAFE_BOTTOM = 78
const SAFE_LEFT = 6
const SAFE_RIGHT = 84
const MAX_WIDTH = 86
const MAX_LINES = 3

function trimToLineCount(
  text: string,
  maxLines: number,
  maxWidth: number,
  measure: (value: string) => number,
): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ")
  let kept = ""
  for (const word of words) {
    const candidate = kept ? `${kept} ${word}` : word
    if (wrapLines(candidate, maxWidth, measure).length > maxLines) break
    kept = candidate
  }
  return kept || words[0] || text
}

/** Citação: até 86% da largura, no máximo 3 linhas, fonte até o mínimo antes de cortar. */
export function shapeQuoteInsert(insert: CompositionInsert): CompositionInsert {
  const styleSize = insert.fontSize && insert.fontSize >= FONT_SIZE_MIN ? insert.fontSize : 56
  const width = Math.min(MAX_WIDTH, SAFE_RIGHT - SAFE_LEFT)
  const maxPx = (width / 100) * FRAME_W
  let font = styleSize
  let text = (insert.text ?? "").replace(/\r/g, "").trim()
  const measureAt = (size: number) => (value: string) => fallbackTextMeasure(size, value)
  let lines = wrapLines(text, maxPx, measureAt(font))
  while (lines.length > MAX_LINES && font > FONT_SIZE_MIN) {
    font = Math.max(FONT_SIZE_MIN, font - 2)
    lines = wrapLines(text, maxPx, measureAt(font))
  }
  if (lines.length > MAX_LINES) {
    text = trimToLineCount(text, MAX_LINES, maxPx, measureAt(font))
    lines = wrapLines(text, maxPx, measureAt(font))
  }
  const blockHPct = (Math.max(1, lines.length) * font * 1.2 / FRAME_H) * 100
  const half = blockHPct / 2
  let y = insert.y ?? 58
  if (y - half < SAFE_TOP) y = SAFE_TOP + half
  if (y + half > SAFE_BOTTOM) y = SAFE_BOTTOM - half
  return {
    ...insert,
    text,
    fontSize: font,
    maxWidthPct: width,
    x: SAFE_LEFT + width / 2,
    y,
  }
}
