import assert from "node:assert/strict"
import { test } from "node:test"

import type { CaptionLine } from "../captions.ts"
import { captionTimestampOffset, offsetCaptionTimestamps, placeSlicedCaptionLines } from "./captions.ts"

const lines: CaptionLine[] = [
  {
    start: 0.2,
    duration: 0.8,
    text: "olha o preço",
    words: [
      { text: "olha", start: 0.2, end: 0.5 },
      { text: "o", start: 0.5, end: 0.6 },
      { text: "preço", start: 0.6, end: 1 },
    ],
  },
]

test("timestamp no tempo do arquivo soma start - trimIn", () => {
  assert.equal(captionTimestampOffset({ start: 3, trimIn: 1 }), 2)
  const shifted = offsetCaptionTimestamps(lines, captionTimestampOffset({ start: 3, trimIn: 1 }))
  assert.equal(shifted[0]?.start, 2.2)
  assert.equal(shifted[0]?.words[0]?.start, 2.2)
  assert.equal(shifted[0]?.words[2]?.end, 3)
  assert.equal(lines[0]?.words[0]?.start, 0.2)
})

test("recorte enviado ao Whisper fica alinhado ao início da faixa", () => {
  const placed = placeSlicedCaptionLines(lines, { start: 3, trimIn: 1 })
  assert.equal(placed[0]?.start, 3.2)
  assert.equal(placed[0]?.words[0]?.start, 3.2)
  assert.equal(placed[0]?.words[0]?.end, 3.5)
})
