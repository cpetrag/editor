import { test } from "node:test"
import assert from "node:assert/strict"

import { withProjectFont } from "./fonts.ts"

test("withProjectFont keeps the project default selected without duplicating", () => {
  assert.deepEqual(withProjectFont(["geist"], "poppins"), ["poppins", "geist"])
  assert.deepEqual(withProjectFont(["poppins", "geist"], "poppins"), ["poppins", "geist"])
  assert.deepEqual(withProjectFont([], "bebas"), ["bebas"])
})
