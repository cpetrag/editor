import assert from "node:assert/strict"
import { test } from "node:test"

import { GB, MIN_FREE_DISK_BYTES, hasEnoughDisk } from "./disk.ts"

test("hasEnoughDisk exige pelo menos 5 GB livres", () => {
  assert.equal(MIN_FREE_DISK_BYTES, 5 * GB)
  assert.equal(hasEnoughDisk(5 * GB), true)
  assert.equal(hasEnoughDisk(5 * GB - 1), false)
  assert.equal(hasEnoughDisk(0), false)
})
