import assert from "node:assert/strict"
import { test } from "node:test"

import { parseAllowedImportUrl } from "./allowlist.ts"

test("aceita youtube e youtu.be", () => {
  assert.equal(parseAllowedImportUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").ok, true)
  assert.equal(parseAllowedImportUrl("https://youtu.be/dQw4w9WgXcQ").platform, "youtube")
})

test("aceita tiktok instagram facebook", () => {
  assert.equal(parseAllowedImportUrl("https://www.tiktok.com/@x/video/123").platform, "tiktok")
  assert.equal(parseAllowedImportUrl("https://vt.tiktok.com/ZMhqK8vXY/").platform, "tiktok")
  assert.equal(parseAllowedImportUrl("https://www.instagram.com/reel/ABC/").platform, "instagram")
  assert.equal(parseAllowedImportUrl("https://www.facebook.com/watch/?v=1").platform, "facebook")
  assert.equal(parseAllowedImportUrl("https://fb.watch/xyz/").platform, "facebook")
})

test("aceita pinterest e pin.it", () => {
  assert.equal(
    parseAllowedImportUrl("https://br.pinterest.com/pin/3940718420189188/").platform,
    "pinterest",
  )
  assert.equal(parseAllowedImportUrl("https://www.pinterest.com/pin/123/").platform, "pinterest")
  assert.equal(parseAllowedImportUrl("https://pin.it/abc").platform, "pinterest")
})

test("aceita x/twitter", () => {
  assert.equal(parseAllowedImportUrl("https://x.com/user/status/123").platform, "x")
  assert.equal(parseAllowedImportUrl("https://twitter.com/user/status/123").platform, "x")
})

test("aceita shopee video share", () => {
  assert.equal(parseAllowedImportUrl("https://br.shp.ee/qsrea8ww").platform, "shopee-video")
  assert.equal(parseAllowedImportUrl("https://shp.ee/abc").platform, "shopee-video")
  assert.equal(
    parseAllowedImportUrl("https://sv.shopee.com.br/share-video/123").platform,
    "shopee-video",
  )
})

test("rejeita shopee produto e outros hosts", () => {
  assert.equal(parseAllowedImportUrl("https://shopee.com.br/product/1/2").ok, false)
  assert.equal(parseAllowedImportUrl("https://www.shopee.com.br/foo").ok, false)
})

test("rejeita host estranho e url inválida", () => {
  assert.equal(parseAllowedImportUrl("https://evil.com/v").ok, false)
  assert.equal(parseAllowedImportUrl("https://evil-pinterest.com/pin/1").ok, false)
  assert.equal(parseAllowedImportUrl("not-a-url").ok, false)
})
