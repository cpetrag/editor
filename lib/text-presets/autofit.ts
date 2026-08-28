import { wrapPresetLines, type MeasureFn } from "./render.ts"

export function autofitFontSize(input: {
  text: string
  fontSize: number
  maxWidth: number
  minFontSize: number
  measure: MeasureFn
}): { fontSize: number; lines: string[]; text: string } {
  const text = input.text
  let fontSize = input.fontSize
  const minFontSize = Math.min(input.minFontSize, input.fontSize)
  while (fontSize > minFontSize && input.measure(text, fontSize) > input.maxWidth) {
    fontSize = Math.max(minFontSize, fontSize * 0.98)
  }
  const lines = wrapPresetLines(text, input.maxWidth, fontSize, input.measure)
  return { fontSize, lines, text }
}
