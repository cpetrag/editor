import assert from "node:assert/strict"
import { test } from "node:test"

import { createMutex } from "./mutex.ts"

test("segunda aquisição falha enquanto busy e volta a funcionar depois do release", () => {
  const mutex = createMutex()
  assert.deepEqual(mutex.snapshot(), { busy: false, currentJobId: null })

  const first = mutex.tryAcquire("job-1")
  assert.equal(first.ok, true)
  assert.deepEqual(mutex.snapshot(), { busy: true, currentJobId: "job-1" })

  const second = mutex.tryAcquire("job-2")
  assert.equal(second.ok, false)
  assert.deepEqual(mutex.snapshot(), { busy: true, currentJobId: "job-1" })

  mutex.release()
  assert.deepEqual(mutex.snapshot(), { busy: false, currentJobId: null })
  assert.equal(mutex.tryAcquire("job-3").ok, true)
})
