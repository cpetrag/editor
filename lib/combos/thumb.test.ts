import assert from "node:assert/strict"
import { test } from "node:test"

import { PLAY_H, PLAY_W } from "../compose/layout.ts"
import { COMBO_THUMB_H, COMBO_THUMB_W, comboThumbCacheKey } from "./thumb.ts"

test("combo thumbs are 180×320 stills of the 1080×1920 frame", () => {
  assert.equal(COMBO_THUMB_W, 180)
  assert.equal(COMBO_THUMB_H, 320)
  assert.equal(COMBO_THUMB_W / PLAY_W, 1 / 6)
  assert.equal(COMBO_THUMB_H / PLAY_H, 1 / 6)
})

test("comboThumbCacheKey isolates combo, video and beat track", () => {
  assert.equal(comboThumbCacheKey("frete-gratis", "vid-1", "gancho"), "frete-gratis:vid-1:gancho")
  assert.notEqual(
    comboThumbCacheKey("frete-gratis", "vid-1", "gancho"),
    comboThumbCacheKey("frete-gratis", "vid-1", "cta"),
  )
  assert.equal(comboThumbCacheKey("frete-gratis", undefined, "prova"), "frete-gratis:none:prova")
})
