import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"

import {
  DEFAULT_CAPCUT_DIR_MAC,
  DEFAULT_CAPCUT_DIR_WIN,
  isInsideCapcutDir,
  resolveCapcutDir,
  sanitizeCapcutFileName,
  uniqueCapcutDest,
} from "./capcut-path.ts"

test("resolveCapcutDir usa CAPCUT_HD_SOURCE quando existir", () => {
  assert.equal(
    resolveCapcutDir({ CAPCUT_HD_SOURCE: " /custom/CapCut " }, "linux"),
    "/custom/CapCut",
  )
})

test("resolveCapcutDir aponta para o HD 1Tb no Mac e no Windows", () => {
  assert.equal(resolveCapcutDir({}, "darwin"), DEFAULT_CAPCUT_DIR_MAC)
  assert.equal(resolveCapcutDir({}, "linux"), DEFAULT_CAPCUT_DIR_MAC)
  assert.equal(resolveCapcutDir({}, "win32"), DEFAULT_CAPCUT_DIR_WIN)
})

test("sanitizeCapcutFileName preserva o nome escolhido e só limpa o perigoso", () => {
  assert.equal(sanitizeCapcutFileName("Meu Anúncio.mp4"), "Meu Anúncio.mp4")
  assert.equal(sanitizeCapcutFileName("anuncio.mp4"), "anuncio.mp4")
  assert.equal(sanitizeCapcutFileName("..\\..\\secret.mp4"), "secret.mp4")
  assert.equal(sanitizeCapcutFileName(""), "video.mp4")
  assert.equal(sanitizeCapcutFileName("Foto <>:.mp4"), "Foto.mp4")
})

test("isInsideCapcutDir recusa traversal", () => {
  const dir = path.resolve("/Volumes/HD 1Tb/Vibecoding/Shopee Reviews/CapCut")
  assert.equal(isInsideCapcutDir(dir, path.join(dir, "ok_export.mp4")), true)
  assert.equal(
    isInsideCapcutDir(dir, path.join(dir, "..", "Editor Video", "x.mp4")),
    false,
  )
})

test("uniqueCapcutDest incrementa o sufixo se o arquivo já existir", () => {
  const dir = path.join("N:", "CapCut")
  const exists = new Set([
    path.join(dir, "anuncio.mp4"),
    path.join(dir, "anuncio-2.mp4"),
  ])
  assert.equal(
    uniqueCapcutDest(dir, "anuncio.mp4", (full) => exists.has(full)),
    path.join(dir, "anuncio-3.mp4"),
  )
})
