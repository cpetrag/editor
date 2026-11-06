import { test } from "node:test"
import assert from "node:assert/strict"

import {
  insertIdOf,
  insertSelection,
  isSourceSelected,
  selectedIdsOf,
  type PreviewSelection,
} from "./preview-selection.ts"

test("insertIdOf and isSourceSelected are exclusive", () => {
  const insert: PreviewSelection = { kind: "insert", id: "a" }
  const source: PreviewSelection = { kind: "source" }
  assert.equal(insertIdOf(insert), "a")
  assert.equal(isSourceSelected(insert), false)
  assert.equal(insertIdOf(source), null)
  assert.equal(isSourceSelected(source), true)
  assert.equal(insertIdOf(null), null)
})

test("selectedIdsOf keeps a single id as the primary and lists the group", () => {
  const single = insertSelection("a", ["a"])
  assert.deepEqual(single, { kind: "insert", id: "a" })
  assert.deepEqual(selectedIdsOf(single), ["a"])
  const group = insertSelection("b", ["a", "b"])
  assert.equal(insertIdOf(group), "b")
  assert.deepEqual(selectedIdsOf(group), ["a", "b"])
})
