import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { freezeCaptionLooks } from "./freeze.ts"

test("caption looks stay frozen against the regression snapshot", () => {
  const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), "regression.snapshot.json")
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as unknown
  assert.deepEqual(freezeCaptionLooks(), snapshot)
})
