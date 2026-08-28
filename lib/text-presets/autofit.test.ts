import { test } from "node:test"
import assert from "node:assert/strict"

import { autofitFontSize } from "./autofit.ts"

test("autofitFontSize reduz 2% até a linha única caber", () => {
  const measure = (text: string, fontSize: number) => text.length * fontSize * 0.5
  const result = autofitFontSize({
    text: "ABCDEFGHIJ",
    fontSize: 100,
    maxWidth: 200,
    minFontSize: 40,
    measure,
  })
  assert.ok(result.fontSize < 100)
  assert.ok(measure(result.text, result.fontSize) <= 200 + 1e-6)
  assert.equal(result.lines.length, 1)
})

test("autofitFontSize quebra linha no piso se ainda não couber", () => {
  const measure = (text: string, fontSize: number) => text.length * fontSize
  const result = autofitFontSize({
    text: "um dois tres quatro",
    fontSize: 80,
    maxWidth: 50,
    minFontSize: 40,
    measure,
  })
  assert.equal(result.fontSize, 40)
  assert.ok(result.lines.length > 1)
})
