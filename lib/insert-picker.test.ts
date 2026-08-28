import { test } from "node:test"
import assert from "node:assert/strict"

import { pickerInsertTypes, TEMPLATES } from "./inserts.ts"

test("picker de elementos só oferece prova social e texto livre", () => {
  const values = pickerInsertTypes()
    .map((item) => item.value)
    .sort()
  assert.deepEqual(values, ["bubble-comentario", "estrelas", "texto-livre"].sort())
})

test("picker de elementos não oferece chips ocultos nem png/legenda", () => {
  const values = pickerInsertTypes().map((item) => item.value)
  for (const hidden of ["logo-shopee", "seta", "contador", "sticker-png", "legenda", "cupom"]) {
    assert.equal(values.includes(hidden), false, hidden)
  }
})

test("templates de combo continuam disponíveis para o picker", () => {
  assert.ok(TEMPLATES.length >= 1)
  assert.ok(TEMPLATES.every((template) => template.inserts.length > 0))
})
