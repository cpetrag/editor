import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DUPLICATE_OFFSET_PCT,
  isDeleteInsertKey,
  isDuplicateInsertKey,
  offsetDuplicatePercents,
  snapRotationDegrees,
} from "./keys.ts"

test("offsetDuplicatePercents desloca 2 pontos percentuais e clampa", () => {
  assert.deepEqual(offsetDuplicatePercents(50, 50), {
    x: 50 + DUPLICATE_OFFSET_PCT,
    y: 50 + DUPLICATE_OFFSET_PCT,
  })
  assert.deepEqual(offsetDuplicatePercents(99, 99), { x: 100, y: 100 })
})

test("snapRotationDegrees só trava 15° com Shift", () => {
  assert.equal(snapRotationDegrees(22, false), 22)
  assert.equal(snapRotationDegrees(22, true), 15)
  assert.equal(snapRotationDegrees(23, true), 30)
})

test("isDeleteInsertKey reconhece Delete e Backspace", () => {
  assert.equal(isDeleteInsertKey({ key: "Delete" }), true)
  assert.equal(isDeleteInsertKey({ key: "Backspace" }), true)
  assert.equal(isDeleteInsertKey({ key: "d" }), false)
})

test("isDuplicateInsertKey reconhece Cmd/Ctrl+D", () => {
  assert.equal(isDuplicateInsertKey({ key: "d", metaKey: true, ctrlKey: false }), true)
  assert.equal(isDuplicateInsertKey({ key: "D", metaKey: false, ctrlKey: true }), true)
  assert.equal(isDuplicateInsertKey({ key: "d", metaKey: false, ctrlKey: false }), false)
})
