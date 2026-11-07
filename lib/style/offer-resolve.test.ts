import assert from "node:assert/strict"
import test from "node:test"

import { resolveInsertStyle } from "./resolve-insert-style.ts"
import { OFFER_PRESET_IDS, offerStylePatch } from "./offer-styles.ts"
import { getPresetStyle } from "./presets.ts"
import type { CompositionInsert } from "../composition.ts"

function textInsert(presetId: string): CompositionInsert {
  return {
    id: "t",
    type: "texto-livre",
    kind: "text",
    start: 0,
    duration: 2,
    text: "NOVO",
    anchor: "center",
    animIn: "none",
    animOut: "none",
    preset: "impacto",
    fontFamily: "anton",
    fontSize: 96,
    styleRef: { presetId, overrides: { animation: { packId: "flutuar" } } },
  }
}

test("os 22 presets vencem o Impacto no insert", () => {
  assert.equal(OFFER_PRESET_IDS.length, 22)
  for (const id of OFFER_PRESET_IDS) {
    const expected = getPresetStyle(id)
    const resolved = resolveInsertStyle(textInsert(id))
    assert.equal(resolved.text.fontFamily, expected.text.fontFamily, id)
    assert.equal(resolved.text.fontSize, expected.text.fontSize, id)
    assert.equal(resolved.text.color, expected.text.color, id)
    assert.equal(resolved.text.background.enabled, expected.text.background.enabled, id)
    assert.equal(resolved.text.background.color, expected.text.background.color, id)
    assert.ok(offerStylePatch(id))
  }
})
