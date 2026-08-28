import { test } from "node:test"
import assert from "node:assert/strict"

import {
  captionWordsLookRelative,
  clampAbsoluteCaptionWords,
  toAbsoluteCaptionWords,
} from "./caption-time.ts"

test("captionWordsLookRelative detects tempos relativos quando o card não começa em 0", () => {
  assert.equal(
    captionWordsLookRelative([{ start: 0, end: 0.4 }], 6, 2),
    true,
  )
  assert.equal(
    captionWordsLookRelative([{ start: 6, end: 6.4 }], 6, 2),
    false,
  )
  assert.equal(
    captionWordsLookRelative([{ start: 0, end: 0.4 }], 0, 2),
    false,
  )
})

test("toAbsoluteCaptionWords soma o start do card nos tempos relativos", () => {
  const abs = toAbsoluteCaptionWords([{ text: "oi", start: 0, end: 0.4 }], 6, 2)
  assert.equal(abs[0]?.start, 6)
  assert.equal(abs[0]?.end, 6.4)
})

test("clampAbsoluteCaptionWords recorta no intervalo do card", () => {
  const clamped = clampAbsoluteCaptionWords(
    [{ text: "fim", start: 9.7, end: 10.2 }],
    9.5,
    0.5,
  )
  assert.equal(clamped[0]?.start, 9.7)
  assert.equal(clamped[0]?.end, 10)
})
