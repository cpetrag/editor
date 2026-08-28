import { test } from "node:test"
import assert from "node:assert/strict"

import { TEXT_PRESET_BOX_MODES } from "./schema.ts"
void TEXT_PRESET_BOX_MODES
import { nextBoxMode } from "./fill.ts"

test("nextBoxMode cicla none → pill → block → highlight-line", () => {
  assert.equal(nextBoxMode("none"), "pill")
  assert.equal(nextBoxMode("pill"), "block")
  assert.equal(nextBoxMode("block"), "highlight-line")
  assert.equal(nextBoxMode("highlight-line"), "none")
})

test("nextBoxMode cobre todos os modos do schema", () => {
  assert.deepEqual([...TEXT_PRESET_BOX_MODES], ["none", "pill", "block", "highlight-line"])
  for (const mode of TEXT_PRESET_BOX_MODES) {
    assert.ok(TEXT_PRESET_BOX_MODES.includes(nextBoxMode(mode)))
  }
})
