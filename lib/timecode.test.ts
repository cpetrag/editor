import { test } from "node:test"
import assert from "node:assert/strict"

import { formatTimecode } from "./timecode.ts"

test("formatTimecode mostra segundos com um decimal", () => {
  assert.equal(formatTimecode(0, 30), "0:00.0")
  assert.equal(formatTimecode(13 + 27 / 30, 30), "0:13.9")
  assert.equal(formatTimecode(14.9, 30), "0:14.9")
  assert.equal(formatTimecode(65 + 15 / 30, 30), "1:05.5")
  assert.equal(formatTimecode(-3, 30), "0:00.0")
})

test("formatTimecode no modo quadro mostra segundo inteiro e quadro", () => {
  assert.equal(formatTimecode(13 + 27 / 30, 30, "frame"), "0:13 · q27")
  assert.equal(formatTimecode(14.9, 30, "frame"), "0:14 · q27")
  assert.equal(formatTimecode(65 + 15 / 30, 30, "frame"), "1:05 · q15")
  assert.equal(formatTimecode(0, 30, "frame"), "0:00 · q0")
})

test("formatTimecode usa 30 fps quando o fps não vem", () => {
  assert.equal(formatTimecode(4.4), "0:04.4")
  assert.equal(formatTimecode(4.4, 0), "0:04.4")
})
