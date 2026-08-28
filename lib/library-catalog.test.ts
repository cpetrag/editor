import { test } from "node:test"
import assert from "node:assert/strict"

import { TEMPLATES } from "./inserts.ts"
import {
  EMPTY_LIBRARY_CATALOG,
  deleteCatalogItem,
  duplicateElement,
  duplicateTemplateInCatalog,
  formatApplyToast,
  parseLibraryCatalog,
  renameCatalogItem,
  visibleElements,
  visibleTemplates,
} from "./library-catalog.ts"

test("formatApplyToast matches the library copy", () => {
  assert.equal(
    formatApplyToast("combo", "Promoção Relâmpago", 2),
    'Combo "Promoção Relâmpago" aplicado · 2 elementos',
  )
  assert.equal(
    formatApplyToast("element", "Preço Riscado", 1),
    'Elemento "Preço Riscado" aplicado · 1 elemento',
  )
})

test("parseLibraryCatalog returns empty on garbage", () => {
  assert.deepEqual(parseLibraryCatalog(null), EMPTY_LIBRARY_CATALOG)
  assert.deepEqual(parseLibraryCatalog("{"), EMPTY_LIBRARY_CATALOG)
  assert.deepEqual(parseLibraryCatalog({ hiddenTemplateIds: "nope" }), EMPTY_LIBRARY_CATALOG)
})

test("visibleTemplates hides, renames and appends duplicates", () => {
  const promo = TEMPLATES.find((item) => item.id === "desconto-relampago")
  assert.ok(promo)
  const hidden = deleteCatalogItem(EMPTY_LIBRARY_CATALOG, "template", promo.id)
  assert.equal(
    visibleTemplates(hidden).some((item) => item.id === promo.id),
    false,
  )

  const renamed = renameCatalogItem(EMPTY_LIBRARY_CATALOG, "template", promo.id, "Flash")
  assert.equal(visibleTemplates(renamed).find((item) => item.id === promo.id)?.name, "Flash")

  const duplicated = duplicateTemplateInCatalog(EMPTY_LIBRARY_CATALOG, promo)
  const extras = visibleTemplates(duplicated.catalog).filter((item) => item.id !== promo.id)
  const copy = extras.find((item) => item.name === "Desconto Relâmpago (cópia)")
  assert.ok(copy)
  assert.equal(copy.inserts.length, promo.inserts.length)
  assert.equal(copy.beats?.length, promo.beats?.length)
  assert.equal(copy.id, duplicated.copy.id)
})

test("visibleElements só lista prova social e texto livre", () => {
  const ids = visibleElements(EMPTY_LIBRARY_CATALOG)
    .map((item) => item.id)
    .sort()
  assert.deepEqual(ids, ["bubble-comentario", "estrelas", "texto-livre"].sort())
})

test("visibleElements ignora extra de tipo oculto e aceita extra de estrelas", () => {
  const withCupom = duplicateElement(EMPTY_LIBRARY_CATALOG, {
    id: "cupom",
    type: "cupom",
    label: "Selo de Cupom",
  })
  assert.equal(
    visibleElements(withCupom.catalog).some((item) => item.type === "cupom"),
    false,
  )
  const withStars = duplicateElement(EMPTY_LIBRARY_CATALOG, {
    id: "estrelas",
    type: "estrelas",
    label: "Avaliação (estrelas)",
  })
  const copy = visibleElements(withStars.catalog).find((item) => item.id === withStars.copy.id)
  assert.ok(copy)
  assert.equal(copy.type, "estrelas")
})

test("visibleElements still hides and renames addable ids", () => {
  const hidden = deleteCatalogItem(EMPTY_LIBRARY_CATALOG, "element", "estrelas")
  assert.equal(
    visibleElements(hidden).some((item) => item.id === "estrelas"),
    false,
  )
  const renamed = renameCatalogItem(EMPTY_LIBRARY_CATALOG, "element", "estrelas", "Reviews")
  assert.equal(visibleElements(renamed).find((item) => item.id === "estrelas")?.label, "Reviews")
})
