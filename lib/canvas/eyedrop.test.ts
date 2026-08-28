import { test } from "node:test"
import assert from "node:assert/strict"

import { rgbToHex, samplePixelHex } from "./eyedrop.ts"

test("rgbToHex formata bytes em #rrggbb", () => {
  assert.equal(rgbToHex(255, 128, 0), "#ff8000")
  assert.equal(rgbToHex(0, 0, 0), "#000000")
})

test("samplePixelHex lê o pixel no buffer RGBA", () => {
  const data = new Uint8ClampedArray([
    10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 1, 2, 3, 255,
  ])
  assert.equal(samplePixelHex(data, 2, 1, 0), "#28323c")
  assert.equal(samplePixelHex(data, 2, 1, 1), "#010203")
})
