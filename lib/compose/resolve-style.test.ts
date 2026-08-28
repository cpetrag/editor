import { test } from "node:test"
import assert from "node:assert/strict"

import { resolveLayerStyle } from "./resolve-style.ts"

test("resolveLayerStyle applies bold-outline stroke by default", () => {
  const style = resolveLayerStyle(
    {
      id: "t",
      type: "texto-livre",
      kind: "text",
      start: 0,
      duration: 3,
      text: "NOVO",
      anchor: "center",
      animIn: "none",
      animOut: "none",
      preset: "bold-outline",
    },
    "archivo",
  )
  assert.equal(style.color, "#ffffff")
  assert.equal(style.stroke?.width, 6)
  assert.equal(style.fontFamily.includes("Archivo"), true)
  assert.equal(style.xPct, 50)
  assert.equal(style.yPct, 35)
})

test("resolveLayerStyle uses sticker-quero pill paint", () => {
  const style = resolveLayerStyle(
    {
      id: "t",
      type: "texto-livre",
      kind: "text",
      start: 0,
      duration: 3,
      text: "QUERO",
      anchor: "center",
      animIn: "none",
      animOut: "none",
      preset: "sticker-quero",
      y: 88,
    },
    "geist",
  )
  assert.equal(style.bgColor, "#ee4d2d")
  assert.equal(style.pillRadius, 999)
  assert.equal(style.yPct, 88)
  assert.equal(style.stroke, undefined)
})

test("resolveLayerStyle clamps text y to the 5-95 draw band", () => {
  const top = resolveLayerStyle(
    {
      id: "t",
      type: "texto-livre",
      kind: "text",
      start: 0,
      duration: 3,
      text: "NOVO",
      anchor: "center",
      animIn: "none",
      animOut: "none",
      y: 0,
    },
    "geist",
  )
  const bottom = resolveLayerStyle(
    {
      id: "t",
      type: "texto-livre",
      kind: "text",
      start: 0,
      duration: 3,
      text: "NOVO",
      anchor: "center",
      animIn: "none",
      animOut: "none",
      y: 100,
    },
    "geist",
  )
  assert.equal(top.yPct, 5)
  assert.equal(bottom.yPct, 95)
})
