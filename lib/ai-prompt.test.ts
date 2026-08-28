import { test } from "node:test"
import assert from "node:assert/strict"

import { aiInsertToInsert } from "./ai-prompt.ts"

test("aiInsertToInsert keeps working when style is absent", () => {
  const insert = aiInsertToInsert({
    type: "alerta-desconto",
    start: 1,
    duration: 4,
    position: "center",
    text: "70% OFF",
  })
  assert.equal(insert.type, "alerta-desconto")
  assert.equal(insert.text, "70% OFF")
  assert.equal(insert.style, undefined)
})

test("aiInsertToInsert attaches a valid style from the model", () => {
  const insert = aiInsertToInsert({
    type: "alerta-desconto",
    start: 1,
    duration: 4,
    text: "70% OFF",
    style: {
      fontFamily: "space-grotesk",
      fontWeight: 700,
      uppercase: true,
      color: "#FFFFFF",
      bgColor: "#EE4D2D",
      strokeWidth: 6,
      strokeColor: "#000000",
      shadow: "soft",
      opacity: 1,
      rotation: 0,
    },
  })
  assert.equal(insert.style?.fontFamily, "space")
  assert.equal(insert.style?.bgColor, "#EE4D2D")
  assert.equal(insert.style?.strokeWidth, 6)
})

test("aiInsertToInsert ignores an invalid style instead of throwing", () => {
  const insert = aiInsertToInsert({
    type: "cupom",
    start: 2,
    duration: 3,
    text: "CUPOM10",
    style: { fontFamily: "papyrus", color: "rainbow" },
  })
  assert.equal(insert.type, "cupom")
  assert.equal(insert.style, undefined)
})
