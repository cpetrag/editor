import assert from "node:assert/strict"
import { test } from "node:test"

import { materializeBlob } from "./blob.ts"

test("materializeBlob copia os bytes para um Blob independente", async () => {
  const original = new Blob(["video-bytes"], { type: "video/mp4" })
  const copy = await materializeBlob(original)
  assert.notEqual(copy, original)
  assert.equal(copy.type, "video/mp4")
  assert.equal(copy.size, original.size)
  assert.equal(await copy.text(), "video-bytes")
})

test("materializeBlob usa octet-stream quando o tipo vem vazio", async () => {
  const original = new Blob(["x"])
  const copy = await materializeBlob(original)
  assert.equal(copy.type, "application/octet-stream")
})
