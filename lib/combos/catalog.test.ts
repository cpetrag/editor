import assert from "node:assert/strict"
import { test } from "node:test"

import { COMBO_TEMPLATES } from "./catalog.ts"
import { isTextPresetId } from "../text-presets/index.ts"
import { isComboElementId } from "./schema.ts"

test("every combo beat has a real text preset or chip element", () => {
  for (const combo of COMBO_TEMPLATES) {
    assert.ok(combo.beats.length >= 3, combo.id)
    for (const beat of combo.beats) {
      if (beat.kind === "text") {
        assert.equal(isTextPresetId(beat.presetId), true, `${combo.id} ${beat.text}`)
      } else {
        assert.equal(isComboElementId(beat.elementId ?? ""), true, combo.id)
      }
    }
  }
})
