import assert from "node:assert/strict"
import test from "node:test"

import { recipeInsertsForEmptyMarkers } from "./recipes.ts"
import { nextContentPreset } from "./presets.ts"

test("moda na calça flare cria gancho, prova, oferta e CTA", () => {
  const inserts = recipeInsertsForEmptyMarkers({
    duration: 20,
    niche: "moda",
    inserts: [],
    cuts: { ganchoEnd: 3, ctaStart: 15 },
    idFor: (index) => `n-${index}`,
  })
  assert.equal(inserts.length, 4)
  assert.deepEqual(
    inserts.map((insert) => insert.contentId),
    ["gancho-moda-1", "prova-moda-1", "oferta-moda-1", "cta-moda-1"],
  )
  assert.equal(inserts[0]?.styleRef?.presetId, "editorial")
  assert.equal(inserts[0]?.styleRef?.overrides.animation?.packId, "elegante")
})

test("não cria texto em marcador que já tem texto", () => {
  const inserts = recipeInsertsForEmptyMarkers({
    duration: 20,
    niche: "shopee",
    inserts: [
      {
        id: "ja",
        type: "texto-livre",
        kind: "text",
        start: 0,
        duration: 2,
        text: "oi",
        anchor: "center",
        animIn: "none",
        animOut: "none",
      },
    ],
    cuts: { ganchoEnd: 3, ctaStart: 15 },
    idFor: (index) => `n-${index}`,
  })
  assert.equal(inserts.some((insert) => insert.contentId?.startsWith("gancho")), false)
  assert.equal(inserts.length, 3)
})

test("gancho que invade a prova não ocupa a prova", () => {
  const inserts = recipeInsertsForEmptyMarkers({
    duration: 15,
    niche: "shopee",
    inserts: [
      {
        id: "novo",
        type: "texto-livre",
        kind: "text",
        start: 0,
        duration: 3,
        text: "NOVO",
        anchor: "center",
        animIn: "none",
        animOut: "none",
      },
    ],
    cuts: { ganchoEnd: 2, ctaStart: 12 },
    productData: { nota: "4,9", vendidos: "12 mil", preco: "R$ 49,90", preco_de: "R$ 89,90" },
    idFor: (index) => `n-${index}`,
  })
  assert.equal(inserts.some((insert) => insert.contentId?.startsWith("gancho")), false)
  assert.equal(inserts.some((insert) => insert.contentId?.startsWith("prova")), true)
  assert.equal(inserts.some((insert) => insert.contentId?.startsWith("oferta")), true)
  assert.equal(inserts.some((insert) => insert.id === "novo"), false)
})

test("sorteio sem preço não usa a receita do preço vazio", () => {
  const inserts = recipeInsertsForEmptyMarkers({
    duration: 20,
    niche: "shopee",
    inserts: [],
    cuts: { ganchoEnd: 3, ctaStart: 15 },
    productData: {},
    idFor: (index) => `n-${index}`,
  })
  const ids = inserts.map((insert) => insert.contentId)
  assert.equal(ids.includes("oferta-shopee-1"), false)
  assert.equal(ids.includes("prova-shopee-1"), false)
  assert.ok(ids.includes("gancho-shopee-1"))
})

test("sortear outra é estável para o mesmo seed", () => {
  const first = nextContentPreset("gancho-shopee-1", "calca")
  const again = nextContentPreset("gancho-shopee-1", "calca")
  assert.equal(first?.id, again?.id)
  assert.notEqual(first?.id, "gancho-shopee-1")
  assert.equal(first?.slot, "gancho")
  assert.equal(first?.niche, "shopee")
})
