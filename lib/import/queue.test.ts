import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { getImportQueue, releaseImport, tryAcquireImport } from "./queue.ts"

afterEach(() => {
  releaseImport()
})

test("segunda aquisição falha enquanto busy", () => {
  const a = tryAcquireImport("job1")
  assert.equal(a.ok, true)
  const b = tryAcquireImport("job2")
  assert.equal(b.ok, false)
  releaseImport()
  assert.equal(tryAcquireImport("job3").ok, true)
})

test("getImportQueue reflete estado busy", () => {
  assert.deepEqual(getImportQueue(), { busy: false, currentJobId: null })

  tryAcquireImport("job-a")
  assert.deepEqual(getImportQueue(), { busy: true, currentJobId: "job-a" })

  const blocked = tryAcquireImport("job-b")
  assert.equal(blocked.ok, false)
  if (!blocked.ok) assert.equal(blocked.currentJobId, "job-a")
  assert.deepEqual(getImportQueue(), { busy: true, currentJobId: "job-a" })

  releaseImport()
  assert.deepEqual(getImportQueue(), { busy: false, currentJobId: null })
})
