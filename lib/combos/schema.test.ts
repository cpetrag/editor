import assert from "node:assert/strict"
import { test } from "node:test"

import { assertComboTemplate, COMBO_TEMPLATE_SCHEMA, isComboTemplate } from "./schema.ts"

function validCombo(patch: Record<string, unknown> = {}) {
  return {
    schema: COMBO_TEMPLATE_SCHEMA,
    id: "desconto-relampago",
    name: "Desconto Relâmpago",
    goal: "Parar o scroll com preço",
    beats: [
      {
        track: "gancho",
        atPct: 0.1,
        durPct: 0.75,
        kind: "text",
        presetId: "impacto",
        text: "PAREI TUDO",
        x: 50,
        y: 22,
        scale: 1,
      },
    ],
    ...patch,
  }
}

test("assertComboTemplate accepts a valid combo", () => {
  const combo = assertComboTemplate(validCombo())
  assert.equal(combo.schema, COMBO_TEMPLATE_SCHEMA)
  assert.equal(combo.beats[0]?.presetId, "impacto")
  assert.equal(combo.beats[0]?.track, "gancho")
})

test("isComboTemplate rejects invalid payloads", () => {
  assert.equal(isComboTemplate(null), false)
  assert.equal(isComboTemplate({}), false)
  assert.throws(() => assertComboTemplate({ schema: "nope", id: "x" }))
  assert.throws(() =>
    assertComboTemplate(
      validCombo({
        beats: [
          {
            track: "gancho",
            atPct: 0.1,
            durPct: 0.75,
            kind: "element",
            elementId: "texto-livre",
            x: 50,
            y: 50,
            scale: 1,
          },
        ],
      }),
    ),
  )
  assert.throws(() =>
    assertComboTemplate(
      validCombo({
        beats: [
          {
            track: "meio",
            atPct: 0.1,
            durPct: 0.75,
            kind: "text",
            presetId: "impacto",
            x: 50,
            y: 50,
            scale: 1,
          },
        ],
      }),
    ),
  )
})
