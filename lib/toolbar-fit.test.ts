import { test } from "node:test"
import assert from "node:assert/strict"

import { visibleToolbarCount } from "./toolbar-fit.ts"

test("visibleToolbarCount keeps every piece on one or two rows", () => {
  assert.equal(visibleToolbarCount([20, 20, 20], 80), 3)
  assert.equal(visibleToolbarCount([40, 40, 40, 40], 90), 4)
})

test("visibleToolbarCount reserves the overflow button when a third row would start", () => {
  const widths = [50, 50, 50, 50, 50]
  const count = visibleToolbarCount(widths, 110)
  assert.ok(count < widths.length)
  assert.ok(count >= 2)
})
