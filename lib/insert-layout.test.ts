import { test } from "node:test"
import assert from "node:assert/strict"

import { layoutInserts, measureChipSize } from "./insert-layout.ts"
import type { CompositionInsert } from "./composition.ts"

function insert(patch: Partial<CompositionInsert> & Pick<CompositionInsert, "id" | "anchor">): CompositionInsert {
  return {
    type: "alerta-desconto",
    start: 0,
    duration: 3,
    text: "text" in patch ? patch.text : patch.id,
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

const FRAME = { width: 1080, height: 1920 }

test("top center and bottom anchors stack in that vertical order", () => {
  const chips = layoutInserts(
    [
      insert({ id: "t", anchor: "top", text: "TOPO" }),
      insert({ id: "c", anchor: "center", text: "CENTRO" }),
      insert({ id: "b", anchor: "bottom", text: "BASE" }),
    ],
    1,
    FRAME,
    "sans-serif",
  )
  const top = chips.find((c) => c.text === "TOPO")
  const center = chips.find((c) => c.text === "CENTRO")
  const bottom = chips.find((c) => c.text === "BASE")
  assert.ok(top && center && bottom)
  assert.ok(top.y < center.y)
  assert.ok(center.y < bottom.y)
})

test("two inserts on the same anchor get different y positions", () => {
  const chips = layoutInserts(
    [
      insert({ id: "a", anchor: "top", text: "A" }),
      insert({ id: "b", anchor: "top", text: "B" }),
    ],
    1,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 2)
  assert.notEqual(chips[0]?.y, chips[1]?.y)
})

test("inactive inserts are omitted", () => {
  const chips = layoutInserts(
    [insert({ id: "later", anchor: "top", start: 8, duration: 2, text: "DEPOIS" })],
    1,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 0)
})

test("logo-shopee does not use the type label as overlay text", () => {
  const chips = layoutInserts(
    [insert({ id: "logo", anchor: "top", type: "logo-shopee", text: undefined })],
    1,
    FRAME,
    "sans-serif",
    "data:image/svg+xml,logo",
  )
  assert.equal(chips.length, 1)
  assert.equal(chips[0]?.mode, "logo")
  assert.equal(chips[0]?.logoSrc, "data:image/svg+xml,logo")
  assert.equal(chips.some((chip) => chip.text.includes("Logo Shopee")), false)
})

test("logo-shopee draws without a configured asset", () => {
  const chips = layoutInserts(
    [insert({ id: "logo", anchor: "top", type: "logo-shopee", text: undefined })],
    1,
    FRAME,
    "sans-serif",
    "",
  )
  assert.equal(chips.length, 1)
  assert.equal(chips[0]?.mode, "logo")
})

test("graphic types do not fall back to the type label", () => {
  const chips = layoutInserts(
    [insert({ id: "frete", anchor: "top", type: "selo-frete", text: undefined })],
    1,
    FRAME,
    "sans-serif",
  )
  assert.ok(chips.every((chip) => chip.text !== "Selo Frete Grátis"))
})

test("layoutInserts places a chip with x/y at the percent center", () => {
  const chips = layoutInserts(
    [
      insert({
        id: "placed",
        anchor: "top",
        text: "TOPO",
        x: 50,
        y: 25,
      }),
    ],
    1,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 1)
  const chip = chips[0]
  assert.ok(chip)
  assert.ok(Math.abs(chip.x + chip.width / 2 - FRAME.width * 0.5) < 1e-6)
  assert.ok(Math.abs(chip.y + chip.height / 2 - FRAME.height * 0.25) < 1e-6)
})

test("measureChipSize grows a text chip with fontSize and keeps the logo size", () => {
  const base = insert({ id: "a", anchor: "top", text: "OFF" })
  const biggerFont = insert({ id: "a", anchor: "top", text: "OFF", fontSize: 26 })
  const scaled = insert({ id: "a", anchor: "top", text: "OFF", scale: 2 })
  const baseSize = measureChipSize(base)
  const fontSize = measureChipSize(biggerFont)
  const scaledSize = measureChipSize(scaled)
  assert.equal(fontSize.width, baseSize.width * 2)
  assert.equal(fontSize.height, baseSize.height * 2)
  assert.equal(scaledSize.width, baseSize.width * 2)
  assert.equal(scaledSize.height, baseSize.height * 2)

  const logo = insert({ id: "logo", anchor: "top", type: "logo-shopee", text: undefined })
  const logoHugeFont = insert({
    id: "logo",
    anchor: "top",
    type: "logo-shopee",
    text: undefined,
    fontSize: 80,
  })
  assert.deepEqual(measureChipSize(logo), measureChipSize(logoHugeFont))
})

test("wrapped stars and comments keep modest corners instead of a pill as tall as the box", () => {
  const review =
    "4,9 · 2mil\nUmaskjaskjsaksakaksajsjasjsajsakjsakjsakjsakjsak asjasjsajsakjsakjsakjsak"
  const chips = layoutInserts(
    [
      insert({
        id: "stars",
        anchor: "center",
        type: "estrelas",
        text: review,
        x: 50,
        y: 40,
      }),
      insert({
        id: "bubble",
        anchor: "center",
        type: "bubble-comentario",
        text: "@fuladsonee\nO produto é muito bom, gostei demais dele, indico a todos que queiram comprar",
        x: 50,
        y: 70,
      }),
    ],
    1,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 2)
  for (const chip of chips) {
    assert.ok(chip.height > 110, chip.id)
    assert.ok(chip.radius <= 22, `${chip.id} radius ${chip.radius}`)
    assert.ok(chip.radius * 2 < chip.height * 0.4, `${chip.id} should not be a pill`)
  }
})

test("a wrapped comment keeps a readable font instead of growing with the box", () => {
  const chips = layoutInserts(
    [
      insert({
        id: "review",
        anchor: "center",
        type: "bubble-comentario",
        text: "@fuladsonee\nO produto é muito bom, gostei demais dele, indico a todos que queiram comprar",
        x: 50,
        y: 50,
      }),
    ],
    1,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 1)
  assert.ok((chips[0]?.fontPx ?? 0) >= 18)
  assert.ok((chips[0]?.fontPx ?? 999) < 80)
  assert.ok((chips[0]?.width ?? 0) <= FRAME.width * 0.72 + 1)
})

test("layoutInserts paints chip text large enough for an overlay, not a 13px seal", () => {
  const chips = layoutInserts(
    [insert({ id: "a", anchor: "top", text: "OFF", fontSize: 26, scale: 1 })],
    1,
    FRAME,
    "sans-serif",
  )
  assert.ok((chips[0]?.fontPx ?? 0) >= 26)
})

test("layoutInserts scales a placed chip from its center", () => {
  const normal = layoutInserts(
    [insert({ id: "a", anchor: "top", text: "OFF", x: 50, y: 50 })],
    1,
    FRAME,
    "sans-serif",
  )
  const scaled = layoutInserts(
    [insert({ id: "a", anchor: "top", text: "OFF", x: 50, y: 50, scale: 2 })],
    1,
    FRAME,
    "sans-serif",
  )
  assert.ok(normal[0] && scaled[0])
  assert.equal(scaled[0].width, normal[0].width * 2)
  assert.equal(scaled[0].height, normal[0].height * 2)
  assert.ok(Math.abs(scaled[0].x + scaled[0].width / 2 - (normal[0].x + normal[0].width / 2)) < 1e-6)
})

test("layoutInserts ignores text and sticker overlays", () => {
  const chips = layoutInserts(
    [
      insert({
        id: "txt",
        anchor: "center",
        type: "texto-livre",
        kind: "text",
        text: "NOVO",
      }),
      insert({
        id: "stk",
        anchor: "bottom",
        type: "sticker-png",
        kind: "sticker",
        text: undefined,
      }),
    ],
    1,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 0)
})

test("layout copies start duration animIn animOut onto each chip", () => {
  const chips = layoutInserts(
    [
      insert({
        id: "t",
        anchor: "top",
        text: "POP",
        start: 1.2,
        duration: 4,
        animIn: "pop",
        animOut: "slide-up",
      }),
    ],
    2,
    FRAME,
    "sans-serif",
  )
  assert.equal(chips.length, 1)
  assert.equal(chips[0]?.start, 1.2)
  assert.equal(chips[0]?.duration, 4)
  assert.equal(chips[0]?.animIn, "pop")
  assert.equal(chips[0]?.animOut, "slide-up")
})
