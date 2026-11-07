import assert from "node:assert/strict"
import test from "node:test"

import { getPresetStyle } from "../style/presets.ts"
import { layoutMarkedText, strikeLine, type MeasureFont } from "./layout.ts"

function measure(text: string, font: MeasureFont): number {
  return text.length * font.size * 0.5
}

test("riscado cruza o run, sem começar depois do glifo", () => {
  const layout = layoutMarkedText({
    text: "~~R$ 99~~",
    style: getPresetStyle("preco-gigante"),
    maxWidth: 1080,
    measure,
    editPreview: true,
  })
  const piece = layout.pieces.find((item) => item.strike)
  assert.ok(piece)
  const line = strikeLine(piece)
  assert.ok(line)
  const midFirst = piece.x + piece.font.size * 0.25
  const midLast = piece.x + piece.width - piece.font.size * 0.25
  assert.ok(line.x0 < midFirst)
  assert.ok(line.x1 > midLast)
  assert.equal(line.x1 - line.x0, piece.width)
  assert.ok(line.thickness > 0)
})

test("variável vazia não entra em caixa alta", () => {
  const layout = layoutMarkedText({
    text: "por {preco}",
    style: getPresetStyle("duplo"),
    maxWidth: 1080,
    measure,
    editPreview: true,
  })
  const missing = layout.pieces.find((piece) => piece.missing)
  assert.equal(missing?.text, "{preco}")
  assert.equal(missing?.color, "#9A5B00")
})
