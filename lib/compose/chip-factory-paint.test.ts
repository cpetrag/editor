import { test } from "node:test"
import assert from "node:assert/strict"

import { layoutInserts } from "../insert-layout.ts"
import type { CompositionInsert } from "../composition.ts"

const FRAME = { width: 1080, height: 1920 }

function chip(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "chip-1",
    type: "alerta-desconto",
    start: 0,
    duration: 3,
    text: "50% OFF",
    anchor: "top",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

test("chip sem factory usa a fonte do recipe de overlay", () => {
  const laid = layoutInserts([chip()], 1, FRAME, "geist")
  assert.equal(laid[0]?.paint.fontFamily, "anton")
  assert.equal(laid[0]?.factoryAnim, undefined)
})

test("chip com carrinhoLaranja pinta laranja, Poppins e usa a animação do preset", () => {
  const laid = layoutInserts(
    [chip({ styleRef: { presetId: "carrinhoLaranja", overrides: {} } })],
    1,
    FRAME,
    "geist",
    "",
    {
      videoDuration: 20,
      project: {},
      tracks: {},
    },
  )
  assert.equal(laid.length, 1)
  assert.equal(laid[0]?.paint.fontFamily, "poppins")
  assert.equal(laid[0]?.paint.fontWeight, 700)
  assert.equal(laid[0]?.paint.bgColor, "#FF6B00")
  assert.equal(laid[0]?.paint.strokeWidth, 0)
  assert.equal(laid[0]?.factoryAnim?.loop.type, "pulse")
})

test("chip com Hormozi fica uppercase em Montserrat sem estourar a altura da pill", () => {
  const plain = layoutInserts([chip()], 1, FRAME, "geist")
  const styled = layoutInserts(
    [chip({ styleRef: { presetId: "hormozi", overrides: {} } })],
    1,
    FRAME,
    "geist",
    "",
    { videoDuration: 20 },
  )
  assert.equal(styled[0]?.paint.fontFamily, "montserrat")
  assert.equal(styled[0]?.paint.uppercase, true)
  assert.equal(styled[0]?.paint.fontWeight, 900)
  assert.ok(Math.abs((styled[0]?.height ?? 0) - (plain[0]?.height ?? 0)) < 1)
})
