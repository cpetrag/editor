import { test } from "node:test"
import assert from "node:assert/strict"

import { extensionFromMime, formatExportSpec, pickExportFormat } from "./mime.ts"

test("pickExportFormat prefers mp4 when the browser supports it", () => {
  const chosen = pickExportFormat((mime) => mime.startsWith("video/mp4"))
  assert.equal(chosen.ext, "mp4")
  assert.equal(chosen.label, "MP4")
  assert.match(chosen.mime, /^video\/mp4/)
})

test("pickExportFormat falls back to webm and uses the webm extension", () => {
  const chosen = pickExportFormat((mime) => mime.includes("webm"))
  assert.equal(chosen.ext, "webm")
  assert.equal(chosen.label, "WebM")
  assert.match(chosen.mime, /^video\/webm/)
})

test("pickExportFormat throws when nothing is supported", () => {
  assert.throws(
    () => pickExportFormat(() => false),
    /não suporta gravação/i,
  )
})

test("extensionFromMime matches the blob type", () => {
  assert.equal(extensionFromMime("video/mp4;codecs=avc1"), "mp4")
  assert.equal(extensionFromMime("video/webm;codecs=vp9,opus"), "webm")
})

test("formatExportSpec uses real size fps mime and duration", () => {
  assert.equal(
    formatExportSpec(720, 1280, 30, "MP4", 18.088),
    "720×1280 · 30fps · MP4 · ~18,1s",
  )
})
