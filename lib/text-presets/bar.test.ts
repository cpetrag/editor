import assert from "node:assert/strict"
import { test } from "node:test"

import type { CompositionInsert } from "../composition.ts"
import { TEXT_INSERT_TYPE } from "../composition.ts"
import {
  applyTextBackground,
  applyTextShadow,
  nudgeTextRadius,
  textBackgroundEnabledOf,
} from "./bar.ts"

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: TEXT_INSERT_TYPE,
    kind: "text",
    start: 0,
    duration: 3,
    text: "OFERTA",
    anchor: "center",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

test("applyTextBackground liga enabled no styleRef", () => {
  const next = { ...textInsert(), ...applyTextBackground(textInsert(), true) }
  assert.equal(next.styleRef?.overrides?.text?.background?.enabled, true)
  const off = { ...next, ...applyTextBackground(next, false) }
  assert.equal(off.styleRef?.overrides?.text?.background?.enabled, false)
})

test("applyTextBackground liga o bgColor do compose para o overlay não reativar o fundo", () => {
  const on = { ...textInsert(), ...applyTextBackground(textInsert(), true) }
  assert.equal(on.style?.bgColor, "#111111")
  const off = { ...on, ...applyTextBackground(on, false) }
  assert.equal(off.style?.bgColor, null)
})

test("applyTextShadow liga soft e desliga para array vazio", () => {
  const on = { ...textInsert(), ...applyTextShadow(textInsert(), true) }
  assert.ok((on.styleRef?.overrides?.text?.shadows?.length ?? 0) > 0)
  const off = { ...on, ...applyTextShadow(on, false) }
  assert.equal(off.styleRef?.overrides?.text?.shadows?.length, 0)
})

test("nudgeTextRadius não muda se o fundo está off", () => {
  const insert = textInsert()
  const next = nudgeTextRadius(insert, 8)
  assert.equal(next.styleRef, undefined)
})

test("nudgeTextRadius sobe o raio com fundo on", () => {
  const on = { ...textInsert(), ...applyTextBackground(textInsert(), true) }
  assert.equal(textBackgroundEnabledOf(on), true)
  const nudged = { ...on, ...nudgeTextRadius(on, 8) }
  assert.ok((nudged.styleRef?.overrides?.text?.background?.radius ?? 0) >= 8)
})
