import assert from "node:assert/strict"
import { test } from "node:test"

import { createDefaultComposition } from "./composition.ts"
import { keepSourceTransform } from "./source-transform.ts"

const ACTIONS = ["corte", "dividir", "juntar", "historico", "lote", "entrada-saida", "editar"] as const

test("ações que mexem no source preservam o zoom do primeiro trecho", () => {
  const base = createDefaultComposition()
  base.source = { ...base.source, duration: 14.2, transform: { scale: 1.28, x: 4, y: -2 } }
  for (const action of ACTIONS) {
    const dropped = {
      ...base,
      source: { ...base.source, duration: base.source.duration, transform: undefined },
    }
    const kept = keepSourceTransform(base, dropped, action)
    assert.equal(kept.source.transform?.scale, 1.28, action)
    assert.equal(kept.source.transform?.x, 4, action)
  }
  const reset = keepSourceTransform(
    base,
    { ...base, source: { ...base.source, transform: undefined } },
    "Resetar enquadramento",
  )
  assert.equal(reset.source.transform, undefined)
  const replaced = keepSourceTransform(
    base,
    { ...base, source: { ...base.source, fileName: "outro.mp4", transform: undefined } },
    "Trocar vídeo",
  )
  assert.equal(replaced.source.transform, undefined)
})
