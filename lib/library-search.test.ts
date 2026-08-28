import { test } from "node:test"
import assert from "node:assert/strict"

import { INSERT_TYPES, TEMPLATES, isAddableElementType } from "./inserts.ts"
import {
  countLibraryResults,
  foldSearch,
  formatLibrarySearchSubtitle,
  matchesQuery,
  midTruncate,
  searchLibrary,
} from "./library-search.ts"

test("foldSearch strips accents and case", () => {
  assert.equal(foldSearch("FRETE GRÁTIS"), foldSearch("frete gratis"))
})

test("matchesQuery finds frete in combo and element labels", () => {
  assert.equal(matchesQuery("Frete Grátis", "frete"), true)
  assert.equal(matchesQuery("Selo Frete Grátis", "frete"), true)
  assert.equal(matchesQuery("Promoção Relâmpago", "frete"), false)
})

test("searchLibrary groups combos, elements, pngs and fonts", () => {
  const pngs = [
    { id: "a", name: "selo-frete-gratis.png", mediaUrl: "/a" },
    { id: "b", name: "seta-oferta.png", mediaUrl: "/b" },
  ]
  const result = searchLibrary("frete", {
    templates: TEMPLATES,
    elements: INSERT_TYPES.filter((item) => isAddableElementType(item.value)).map((item) => ({
      id: item.value,
      type: item.value,
      label: item.label,
      meta: item,
    })),
    pngs,
    fonts: [
      { id: "geist", label: "Geist" },
      { id: "poppins", label: "Poppins" },
    ],
  })
  assert.ok(result.templates.some((item) => item.id === "frete-gratis"))
  assert.equal(result.elements.length, 0)
  const stars = searchLibrary("estrelas", {
    templates: TEMPLATES,
    elements: INSERT_TYPES.filter((item) => isAddableElementType(item.value)).map((item) => ({
      id: item.value,
      type: item.value,
      label: item.label,
      meta: item,
    })),
    pngs,
    fonts: [
      { id: "geist", label: "Geist" },
      { id: "poppins", label: "Poppins" },
    ],
  })
  assert.ok(stars.elements.some((item) => item.type === "estrelas"))
  assert.equal(result.pngs.length, 1)
  assert.equal(result.pngs[0]?.name, "selo-frete-gratis.png")
  assert.equal(result.fonts.length, 0)
})

test("midTruncate keeps the filename suffix", () => {
  assert.equal(midTruncate("curto.png"), "curto.png")
  assert.equal(midTruncate("Clique e aproveite ver04.png"), "Clique e ap…er04.png")
  assert.notEqual(
    midTruncate("Clique e aproveite ver01.png"),
    midTruncate("Clique e aproveite ver04.png"),
  )
})

test("formatLibrarySearchSubtitle counts grouped hits", () => {
  assert.equal(
    formatLibrarySearchSubtitle("", 10),
    "Combos, elementos, PNGs e fontes — clique para aplicar no projeto.",
  )
  assert.equal(formatLibrarySearchSubtitle("  frete  ", 1), '1 resultado para "frete"')
  assert.equal(formatLibrarySearchSubtitle("garanta", 5), '5 resultados para "garanta"')
})

test("countLibraryResults sums all groups", () => {
  assert.equal(
    countLibraryResults({
      templates: TEMPLATES.slice(0, 2),
      elements: [],
      pngs: [{ id: "a", name: "a.png", mediaUrl: "/a" }],
      fonts: [{ id: "geist", label: "Geist" }],
    }),
    4,
  )
})
