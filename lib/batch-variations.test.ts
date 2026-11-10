import assert from "node:assert/strict"
import { test } from "node:test"

import { buildVariations } from "./inserts.ts"

test("buildVariations preenche o nome da fonte", () => {
  const items = buildVariations("Anúncio", {
    hooks: ["Oferta", "Frete"],
    fonts: ["geist"],
    positions: ["top", "bottom"],
  })
  assert.equal(items.length, 4)
  assert.deepEqual(
    items.map((item) => item.fontLabel),
    ["Geist", "Geist", "Geist", "Geist"],
  )
  assert.match(items[0]?.fileName ?? "", /_v01_oferta_geist_top\.mp4$/)

  const missing = buildVariations("Anúncio", {
    hooks: ["Oferta"],
    fonts: ["fonte-que-nao-existe"],
    positions: ["center"],
  })
  assert.equal(missing[0]?.fontLabel, "fonte-que-nao-existe")
})
