import assert from "node:assert/strict"
import test from "node:test"

import { FACTORY_PRESET_IDS, getPresetStyle } from "../style/presets.ts"
import { OFFER_PRESET_IDS } from "../style/offer-styles.ts"
import { layoutInsert, layoutMarkedText, strikeLine, type MeasureFont } from "./layout.ts"

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

function gaps(text: string, presetId: string) {
  const layout = layoutInsert(text, getPresetStyle(presetId))
  const pieces = layout.pieces.filter((piece) => piece.text.trim().length > 0)
  return pieces
}

test("espaço entre palavras avança o x", () => {
  const pieces = gaps("Achei o *melhor*", "sticker")
  assert.equal(pieces.length, 3)
  assert.ok(pieces[1]!.x > pieces[0]!.x + pieces[0]!.width)
  assert.ok(pieces[2]!.x > pieces[1]!.x + pieces[1]!.width)
})

test("espaço antes e depois do run riscado", () => {
  const pieces = gaps("De ~~R$ 9~~ por", "sticker")
  const strike = pieces.findIndex((piece) => piece.strike)
  assert.ok(strike > 0)
  assert.ok(pieces[strike]!.x > pieces[strike - 1]!.x + pieces[strike - 1]!.width)
  assert.ok(pieces[strike + 1]!.x > pieces[strike]!.x + pieces[strike]!.width)
})

test("os 22 estilos novos e os 16 de fábrica preservam o espaço", () => {
  for (const id of [...OFFER_PRESET_IDS, ...FACTORY_PRESET_IDS]) {
    const pieces = gaps("Achei o *melhor*", id)
    assert.equal(pieces.length, 3, id)
    assert.ok(pieces[1]!.x - (pieces[0]!.x + pieces[0]!.width) > 0, id)
  }
})

test("caixa alta vale para o destaque, exceto com fonte de script", () => {
  const vazado = layoutInsert("Achei o *melhor*", getPresetStyle("vazado"))
  assert.deepEqual(
    vazado.pieces.map((piece) => piece.text),
    ["ACHEI", "O", "MELHOR"],
  )
  const script = layoutInsert("Achei o *melhor*", getPresetStyle("script-caps"))
  assert.equal(script.pieces.find((piece) => piece.accent)?.text, "melhor")
  assert.equal(script.pieces[0]?.text, "ACHEI")
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
