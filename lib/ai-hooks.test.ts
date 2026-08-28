import { test } from "node:test"
import assert from "node:assert/strict"

import { mergeHooks, parseHooksPayload } from "./ai-hooks.ts"

test("parseHooksPayload keeps up to four trimmed strings", () => {
  const hooks = parseHooksPayload({
    hooks: ["  A  ", "B", "", "C", "D", "E"],
  })
  assert.deepEqual(hooks, ["A", "B", "C", "D"])
})

test("mergeHooks concatenates without duplicating", () => {
  assert.deepEqual(mergeHooks(["A"], ["A", "B"]), ["A", "B"])
})
