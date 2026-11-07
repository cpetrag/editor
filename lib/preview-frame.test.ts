import { test } from "node:test"
import assert from "node:assert/strict"

import { fitPreviewFrame } from "./preview-frame.ts"

test("fitPreviewFrame keeps 9:16 inside the available box", () => {
  assert.deepEqual(fitPreviewFrame(900, 1600), { width: 900, height: 1600 })
  assert.deepEqual(fitPreviewFrame(1000, 1600), { width: 900, height: 1600 })
  assert.deepEqual(fitPreviewFrame(450, 2000), { width: 450, height: 800 })
})

test("fitPreviewFrame returns nothing when a side is missing", () => {
  assert.deepEqual(fitPreviewFrame(0, 400), { width: 0, height: 0 })
  assert.deepEqual(fitPreviewFrame(Number.NaN, 400), { width: 0, height: 0 })
})
