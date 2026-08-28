import { test } from "node:test"
import assert from "node:assert/strict"

import { TEMPLATES } from "./inserts.ts"
import { comboDuration, comboOverflowsVideo } from "./library-preview.ts"

test("comboDuration follows the last beat on the 15s preview clock", () => {
  const promo = TEMPLATES.find((item) => item.id === "desconto-relampago")
  assert.ok(promo)
  const duration = comboDuration(promo, 0)
  assert.ok(duration > 10)
  assert.ok(duration <= 15 + 1e-6)
})

test("beat combos do not overflow because times clamp to the video zones", () => {
  const promo = TEMPLATES.find((item) => item.id === "desconto-relampago")
  assert.ok(promo)
  assert.equal(comboOverflowsVideo(promo, 0), false)
  assert.equal(comboOverflowsVideo(promo, 12), false)
  assert.equal(comboOverflowsVideo(promo, 7), false)
})
