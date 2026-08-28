import assert from "node:assert/strict"
import { test } from "node:test"

import { COMBO_TEMPLATES, getComboTemplate } from "./catalog.ts"
import { applyComboToInserts, instantiateCombo } from "./instantiate.ts"

test("catalog has the 8 visual combos", () => {
  assert.equal(COMBO_TEMPLATES.length, 8)
  assert.ok(getComboTemplate("desconto-relampago"))
  assert.ok(getComboTemplate("frete-gratis"))
  assert.ok(getComboTemplate("prova-social"))
  assert.ok(getComboTemplate("escassez"))
  assert.ok(getComboTemplate("antes-depois"))
  assert.ok(getComboTemplate("tutorial-3-passos"))
  assert.ok(getComboTemplate("cupom-preco"))
  assert.ok(getComboTemplate("espera-final"))
})

test("instantiateCombo writes preset text and scales CTA with the video", () => {
  const combo = getComboTemplate("desconto-relampago")
  assert.ok(combo)
  const short = instantiateCombo(combo, 12)
  const long = instantiateCombo(combo, 30)
  const gancho = short.find((insert) => insert.text?.includes("PAREI TUDO"))
  const ctaShort = short.find((insert) => insert.text?.includes("LINK NA BIO"))
  const ctaLong = long.find((insert) => insert.text?.includes("LINK NA BIO"))
  assert.equal(gancho?.preset, "impacto")
  assert.equal(gancho?.kind, "text")
  assert.ok(ctaShort && ctaLong)
  assert.ok(ctaShort.start < ctaLong.start)
  assert.ok(ctaShort.start >= 12 * 0.7 - 1e-9)
  assert.ok(ctaLong.start >= 30 * 0.7 - 1e-9)
})

test("text beats keep the preset size instead of flattening everything to 96px", () => {
  const combo = getComboTemplate("prova-social")
  assert.ok(combo)
  const inserts = instantiateCombo(combo, 15)
  const impacto = inserts.find((insert) => insert.preset === "impacto")
  const apoio = inserts.find((insert) => insert.preset === "apoio")
  assert.ok(impacto && apoio)
  assert.ok((apoio.fontSize ?? 0) < (impacto.fontSize ?? 0))
  assert.ok((impacto.fontSize ?? 0) >= 90)
  assert.ok((apoio.fontSize ?? 0) <= 55)
})

test("applyComboToInserts keeps captions and replaces the other inserts", () => {
  const combo = getComboTemplate("frete-gratis")
  assert.ok(combo)
  const previous = [
    {
      id: "old",
      type: "alerta-desconto" as const,
      start: 1,
      duration: 2,
      anchor: "center" as const,
      animIn: "none" as const,
      animOut: "none" as const,
      text: "50% OFF",
    },
    {
      id: "cap",
      type: "legenda" as const,
      kind: "caption" as const,
      start: 0,
      duration: 4,
      anchor: "bottom" as const,
      animIn: "none" as const,
      animOut: "none" as const,
      text: "legenda original",
    },
  ]
  const next = applyComboToInserts(previous, combo, 16)
  assert.equal(next.some((insert) => insert.id === "old"), false)
  const caption = next.find((insert) => insert.id === "cap")
  assert.equal(caption?.text, "legenda original")
  assert.ok(next.some((insert) => insert.text === "ACHEI COM FRETE GRÁTIS"))
  assert.ok(next.some((insert) => insert.type === "selo-frete"))
})
