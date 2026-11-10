import { test } from "node:test"
import assert from "node:assert/strict"

import type { CompositionInsert } from "../composition.ts"
import {
  DEFAULT_STYLE_BY_TYPE,
  FONT_IDS,
  WEIGHTS_BY_FONT,
  parseFontId,
  parseInsertStyle,
  resolveInsertStyle,
  clampFontWeight,
  patchInsertStyle,
  canvasShadow,
} from "./insert-style.ts"

const CHIP_TYPES = [
  "logo-shopee",
  "selo-frete",
  "alerta-desconto",
  "preco-riscado",
  "cupom",
  "contador",
  "barra-estoque",
  "estrelas",
  "seta",
  "tarja-frete",
  "seta-mao",
  "circulo-destaque",
  "bubble-comentario",
  "divisor-antes-depois",
  "passo",
  "tarja-espera",
] as const

function chip(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "i1",
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

test("DEFAULT_STYLE_BY_TYPE covers the 11 insert types and matches the current chip paint", () => {
  for (const type of CHIP_TYPES) {
    const style = DEFAULT_STYLE_BY_TYPE[type]
    assert.ok(style, type)
    assert.equal(style.fontFamily, "geist")
    assert.equal(style.fontWeight, 600)
    assert.equal(style.uppercase, false)
    assert.equal(style.color, "#ffffff")
    assert.equal(style.bgColor, "rgba(0,0,0,0.6)")
    assert.equal(style.strokeWidth, 0)
    assert.equal(style.strokeColor, "#000000")
    assert.equal(style.shadow, "none")
    assert.equal(style.opacity, 1)
    assert.equal(style.rotation, 0)
  }
})

test("DEFAULT_STYLE_BY_TYPE for texto-livre matches the bold-outline preset", () => {
  const style = DEFAULT_STYLE_BY_TYPE["texto-livre"]
  assert.equal(style.fontFamily, "geist")
  assert.equal(style.fontWeight, 800)
  assert.equal(style.uppercase, false)
  assert.equal(style.color, "#ffffff")
  assert.equal(style.bgColor, null)
  assert.equal(style.strokeWidth, 6)
  assert.equal(style.strokeColor, "#000000")
  assert.equal(style.shadow, "none")
})

test("DEFAULT_STYLE_BY_TYPE for legenda matches the bold-outline preset", () => {
  const style = DEFAULT_STYLE_BY_TYPE.legenda
  assert.equal(style.fontFamily, "geist")
  assert.equal(style.fontWeight, 800)
  assert.equal(style.uppercase, false)
  assert.equal(style.color, "#ffffff")
  assert.equal(style.bgColor, null)
  assert.equal(style.strokeWidth, 6)
  assert.equal(style.strokeColor, "#000000")
  assert.equal(style.shadow, "none")
})

test("parseInsertStyle returns undefined when style is missing or not an object", () => {
  assert.equal(parseInsertStyle(undefined), undefined)
  assert.equal(parseInsertStyle(null), undefined)
  assert.equal(parseInsertStyle("geist"), undefined)
  assert.equal(parseInsertStyle({}), undefined)
})

test("parseInsertStyle accepts canonical font ids and the spec aliases", () => {
  const canonical = parseInsertStyle({
    fontFamily: "archivo",
    fontWeight: 700,
    uppercase: true,
    color: "#EE4D2D",
    bgColor: null,
    strokeWidth: 6,
    strokeColor: "#000000",
    shadow: "glow",
    opacity: 0.8,
    rotation: -12,
  })
  assert.equal(canonical?.fontFamily, "archivo")
  assert.equal(canonical?.strokeWidth, 6)
  assert.equal(canonical?.shadow, "glow")

  const aliased = parseInsertStyle({
    fontFamily: "archivo-black",
    fontWeight: 900,
    uppercase: false,
    color: "#fff",
    bgColor: "#000000",
    strokeWidth: 0,
    strokeColor: "#111111",
    shadow: "soft",
    opacity: 1,
    rotation: 0,
  })
  assert.equal(aliased?.fontFamily, "archivo")

  const space = parseInsertStyle({
    fontFamily: "space-grotesk",
    fontWeight: 500,
    uppercase: false,
    color: "#ffffff",
    bgColor: null,
    strokeWidth: 1,
    strokeColor: "#000",
    shadow: "hard",
    opacity: 1,
    rotation: 30,
  })
  assert.equal(space?.fontFamily, "space")
})

test("parseInsertStyle clamps numeric fields and drops invalid style objects", () => {
  const parsed = parseInsertStyle({
    fontFamily: "bebas",
    fontWeight: 650,
    uppercase: false,
    color: "#ffffff",
    bgColor: "nope",
    strokeWidth: 99,
    strokeColor: "#000000",
    shadow: "huge",
    opacity: 4,
    rotation: -90,
  })
  assert.equal(parsed?.fontWeight, 600)
  assert.equal(parsed?.bgColor, null)
  assert.equal(parsed?.strokeWidth, 12)
  assert.equal(parsed?.shadow, "none")
  assert.equal(parsed?.opacity, 1)
  assert.equal(parsed?.rotation, -90)
  assert.equal(parseInsertStyle({ fontFamily: "comic-sans", color: "red" }), undefined)
})

test("parseInsertStyle keeps rotation beyond ±30", () => {
  assert.equal(parseInsertStyle({ rotation: 45 })?.rotation, 45)
})

test("resolveInsertStyle leaves legacy inserts on the type default plus brand font", () => {
  const resolved = resolveInsertStyle(chip(), "poppins")
  assert.equal(resolved.fontFamily, "poppins")
  assert.equal(resolved.fontWeight, 600)
  assert.equal(resolved.color, "#ffffff")
  assert.equal(resolved.bgColor, "rgba(0,0,0,0.6)")
  assert.equal(resolved.strokeWidth, 0)
})

test("resolveInsertStyle uses an explicit style over the type default", () => {
  const resolved = resolveInsertStyle(
    chip({
      style: {
        fontFamily: "bebas",
        fontWeight: 400,
        uppercase: true,
        color: "#EE4D2D",
        bgColor: null,
        strokeWidth: 6,
        strokeColor: "#000000",
        shadow: "hard",
        opacity: 0.5,
        rotation: 8,
      },
    }),
    "geist",
  )
  assert.equal(resolved.fontFamily, "bebas")
  assert.equal(resolved.uppercase, true)
  assert.equal(resolved.bgColor, null)
  assert.equal(resolved.strokeWidth, 6)
  assert.equal(resolved.shadow, "hard")
  assert.equal(resolved.opacity, 0.5)
  assert.equal(resolved.rotation, 8)
})

test("FONT_IDS lists the families in spec order", () => {
  assert.deepEqual([...FONT_IDS], [
    "geist",
    "poppins",
    "bebas",
    "archivo",
    "playfair",
    "space",
    "oswald",
    "montserrat",
    "anton",
    "inter",
    "alfa",
    "nunito",
    "lilita",
    "luckiest",
    "baloo",
    "titan",
    "caveat",
    "courier",
    "archivo-black",
    "permanent-marker",
    "pacifico",
    "fredoka",
  ])
})

test("parseFontId accepts the three new canonical ids", () => {
  assert.equal(parseFontId("oswald"), "oswald")
  assert.equal(parseFontId("montserrat"), "montserrat")
  assert.equal(parseFontId("anton"), "anton")
  assert.equal(parseFontId("Inter"), "inter")
})

test("parseFontId accepts the caption display families", () => {
  assert.equal(parseFontId("alfa"), "alfa")
  assert.equal(parseFontId("alfa-slab-one"), "alfa")
  assert.equal(parseFontId("nunito"), "nunito")
  assert.equal(parseFontId("lilita-one"), "lilita")
  assert.equal(parseFontId("luckiest-guy"), "luckiest")
  assert.equal(parseFontId("baloo-2"), "baloo")
  assert.equal(parseFontId("titan-one"), "titan")
})

test("parseFontId accepts hosted text-preset families", () => {
  assert.equal(parseFontId("caveat"), "caveat")
  assert.equal(parseFontId("courier"), "courier")
  assert.equal(parseFontId("courier-prime"), "courier")
})

test("clampFontWeight snaps down to a weight the family actually has", () => {
  assert.equal(clampFontWeight("bebas", 800), 400)
  assert.equal(clampFontWeight("oswald", 900), 700)
  assert.equal(clampFontWeight("montserrat", 700), 700)
  assert.equal(clampFontWeight("anton", 400), 400)
})

test("WEIGHTS_BY_FONT matches the spec tables", () => {
  assert.deepEqual([...WEIGHTS_BY_FONT.space], [400, 500, 600, 700])
  assert.deepEqual([...WEIGHTS_BY_FONT.bebas], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.archivo], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.anton], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.alfa], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.lilita], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.luckiest], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.titan], [400])
  assert.deepEqual([...WEIGHTS_BY_FONT.baloo], [400, 500, 600, 700, 800])
  assert.deepEqual([...WEIGHTS_BY_FONT.nunito], [400, 500, 600, 700, 800, 900])
  assert.deepEqual([...WEIGHTS_BY_FONT.caveat], [700])
  assert.deepEqual([...WEIGHTS_BY_FONT.courier], [700])
})

test("resolveInsertStyle clamps weight for draw without requiring a persist rewrite", () => {
  const resolved = resolveInsertStyle({
    type: "alerta-desconto",
    style: {
      fontFamily: "bebas",
      fontWeight: 800,
      uppercase: false,
      color: "#ffffff",
      bgColor: null,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadow: "none",
      opacity: 1,
      rotation: 0,
    },
  })
  assert.equal(resolved.fontWeight, 400)
})

test("patchInsertStyle does not clamp weight when only color changes", () => {
  const insert = {
    type: "alerta-desconto" as const,
    style: {
      fontFamily: "bebas" as const,
      fontWeight: 800 as const,
      uppercase: false,
      color: "#ffffff",
      bgColor: null,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadow: "none" as const,
      opacity: 1,
      rotation: 0,
    },
  }
  const patched = patchInsertStyle(insert, { color: "#EE4D2D" })
  assert.equal(patched.fontWeight, 800)
  assert.equal(patched.color, "#EE4D2D")
})

test("patchInsertStyle clamps weight when fontFamily changes", () => {
  const insert = {
    type: "alerta-desconto" as const,
    style: {
      fontFamily: "poppins" as const,
      fontWeight: 800 as const,
      uppercase: false,
      color: "#ffffff",
      bgColor: null,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadow: "none" as const,
      opacity: 1,
      rotation: 0,
    },
  }
  const patched = patchInsertStyle(insert, { fontFamily: "anton" })
  assert.equal(patched.fontFamily, "anton")
  assert.equal(patched.fontWeight, 400)
})

test("canvasShadow exposes the four fixed presets", () => {
  assert.equal(canvasShadow("none", "#ffffff"), null)
  const soft = canvasShadow("soft", "#ffffff")
  assert.ok(soft && soft.blur > 0 && soft.offsetY > 0)
  const hard = canvasShadow("hard", "#ffffff")
  assert.ok(hard && hard.blur === 0 && hard.offsetX > 0)
  const glow = canvasShadow("glow", "#EE4D2D")
  assert.ok(glow && glow.blur > 0 && glow.color === "#EE4D2D")
})
