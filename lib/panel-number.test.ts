import { test } from "node:test"
import assert from "node:assert/strict"

import { formatPanelNumber, roundPanelNumber } from "./panel-number.ts"

test("roundPanelNumber keeps at most one decimal", () => {
  assert.equal(roundPanelNumber(79.25318190718623), 79.3)
  assert.equal(roundPanelNumber(10.04), 10)
  assert.equal(roundPanelNumber(6), 6)
  assert.equal(roundPanelNumber(Number.NaN), 0)
})

test("formatPanelNumber drops a trailing zero", () => {
  assert.equal(formatPanelNumber(79.25318190718623), "79.3")
  assert.equal(formatPanelNumber(132), "132")
  assert.equal(formatPanelNumber(10), "10")
})
