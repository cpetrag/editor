import { test } from "node:test"
import assert from "node:assert/strict"

import { parseAllowedImportUrl } from "./import/allowlist.ts"
import {
  authorFromImportUrl,
  canonicalizeImportUrl,
  classifyImportUrl,
  sourceHeadline,
  sourceTechLine,
} from "./source-url.ts"

test("canonicalizeImportUrl remove tracking e guarda o path", () => {
  const raw =
    "https://www.tiktok.com/@lojadasandalia/video/7423123456789?is_from_webapp=1&sender_device=pc&utm_source=share&si=abc"
  assert.equal(
    canonicalizeImportUrl(raw),
    "https://www.tiktok.com/@lojadasandalia/video/7423123456789",
  )
})

test("authorFromImportUrl lê o @ do TikTok", () => {
  assert.equal(
    authorFromImportUrl("https://www.tiktok.com/@lojadasandalia/video/7423"),
    "@lojadasandalia",
  )
})

test("classifyImportUrl marca perfil TikTok como NOT_A_VIDEO", () => {
  const result = classifyImportUrl("https://www.tiktok.com/@lojadasandalia")
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "NOT_A_VIDEO")
})

test("classifyImportUrl aceita shortlink e vídeo", () => {
  assert.equal(classifyImportUrl("https://vm.tiktok.com/ZMhqK8vXY/").ok, true)
  assert.equal(classifyImportUrl("https://vt.tiktok.com/ZMhqK8vXY/").ok, true)
  assert.equal(classifyImportUrl("https://www.tiktok.com/@x/video/123").ok, true)
})

test("classifyImportUrl aceita o mp4 do catálogo e recusa a home", () => {
  assert.equal(
    classifyImportUrl("https://shopeevideos.macmini-capture.cc/media/gdjj0g5l/video.mp4").ok,
    true,
  )
  const home = classifyImportUrl("https://shopeevideos.macmini-capture.cc/")
  assert.equal(home.ok, false)
  if (!home.ok) assert.equal(home.code, "NOT_A_VIDEO")
})

test("classifyImportUrl recusa host de fora", () => {
  const result = classifyImportUrl("https://vimeo.com/123")
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, "UNSUPPORTED")
})

test("vt.tiktok.com entra na allowlist", () => {
  assert.equal(parseAllowedImportUrl("https://vt.tiktok.com/ZMhqK8vXY/").ok, true)
  assert.equal(parseAllowedImportUrl("https://vt.tiktok.com/ZMhqK8vXY/").platform, "tiktok")
})

test("sourceHeadline prefere author e title e cai para remoteUrl e fileName", () => {
  assert.equal(
    sourceHeadline({
      duration: 10,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "clip.mp4",
      fileId: "a",
      author: "@loja",
      title: "sandália anabela",
    }),
    "@loja · sandália anabela",
  )
  assert.equal(
    sourceHeadline({
      duration: 10,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "clip.mp4",
      fileId: "a",
      remoteUrl: "https://www.tiktok.com/@loja/video/1",
    }),
    "https://www.tiktok.com/@loja/video/1",
  )
  assert.equal(
    sourceHeadline({
      duration: 10,
      fps: 30,
      width: 720,
      height: 1280,
      fileName: "vitrine_Sandália.mp4",
      fileId: "a",
    }),
    "vitrine_Sandália.mp4",
  )
})

test("sourceTechLine usa tabular de duração e resolução", () => {
  assert.equal(
    sourceTechLine({
      duration: 14.2,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "clip.mp4",
      fileId: "a",
    }),
    "0:14 · 1080×1920 · 30fps",
  )
})
