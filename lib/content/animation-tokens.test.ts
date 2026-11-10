import assert from "node:assert/strict"
import test from "node:test"

import { applyPack } from "../motion/catalog.ts"
import { getPresetStyle } from "../style/presets.ts"
import { animationPlainText, animationTokens, reservedLineWidths } from "./animation-tokens.ts"

const PHRASE = "POV: você achou o *achadinho* do mês"

test("tokens de animação guardam espaços e o destaque", () => {
  const tokens = animationTokens(PHRASE)
  assert.equal(animationPlainText(tokens), "POV: você achou o achadinho do mês")
  assert.ok(tokens.some((token) => token.kind === "space" && token.text === " "))
  const accent = tokens.find((token) => token.accent)
  assert.equal(accent?.text, "achadinho")
  assert.equal(accent?.kind, "word")
  assert.deepEqual(
    tokens.filter((token) => token.kind === "word").map((token) => token.text),
    ["POV:", "você", "achou", "o", "achadinho", "do", "mês"],
  )
})

test("a linha do Estouro tem a mesma largura em 0,1 s, 0,3 s e 1 s", () => {
  const base = getPresetStyle("sticker")
  const style = { ...base, text: { ...base.text }, animation: applyPack(base.animation, "estouro") }
  const widths = [0.1, 0.3, 1].map(() => reservedLineWidths(PHRASE, style))
  assert.deepEqual(widths[0], widths[1])
  assert.deepEqual(widths[1], widths[2])
  assert.ok((widths[0]?.[0] ?? 0) > 0)
})
