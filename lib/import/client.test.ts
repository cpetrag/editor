import { test } from "node:test"
import assert from "node:assert/strict"

import { parseStartImportResponse } from "./client.ts"

test("parseStartImportResponse aceita job novo", () => {
  const parsed = parseStartImportResponse(200, { jobId: "abc", status: "running" })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.jobId, "abc")
    assert.equal(parsed.attached, false)
  }
})

test("parseStartImportResponse anexa ao currentJobId no 429", () => {
  const parsed = parseStartImportResponse(429, {
    error: "download em andamento",
    currentJobId: "job-ocupado",
  })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.jobId, "job-ocupado")
    assert.equal(parsed.attached, true)
  }
})

test("parseStartImportResponse 400 vira erro", () => {
  const parsed = parseStartImportResponse(400, { error: "host não permitido" })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.equal(parsed.error, "host não permitido")
})
