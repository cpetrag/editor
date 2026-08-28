import { test } from "node:test"
import assert from "node:assert/strict"

import {
  insertIdOf,
  isSourceSelected,
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
