import { test } from "node:test"
import assert from "node:assert/strict"

import { isEditableTarget } from "./is-editable-target.ts"

test("null is not an editable target", () => {
  assert.equal(isEditableTarget(null), false)
})
