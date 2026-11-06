import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import {
  ensureServeUrl,
  isLocalBundleReady,
  isWebpackBundleMissingError,
  runWithMissingBundleRetry,
  userMessageFromRenderError,
  webpackBundleIndex,
} from "./bundle-cache.ts"

const MISSING_BUNDLE =
  "Tried to serve the Webpack bundle on a HTTP server, but the file /var/folders/bw/zkl93t8d5rj86tqhz6d4m56r0000gn/T/remotion-webpack-bundle-wgJTct/index.html does not exist. Is this a valid path to a Webpack bundle?"

test("webpackBundleIndex ignora URL http e caminho vazio", () => {
  assert.equal(webpackBundleIndex(""), null)
  assert.equal(webpackBundleIndex("   "), null)
  assert.equal(webpackBundleIndex("http://bundle.local"), null)
  assert.equal(webpackBundleIndex("https://cdn.example/bundle"), null)
})

test("webpackBundleIndex aponta para index.html no diretório do bundle", () => {
  assert.equal(
    webpackBundleIndex("/tmp/remotion-webpack-bundle-abc"),
    path.join("/tmp/remotion-webpack-bundle-abc", "index.html"),
  )
})

test("isWebpackBundleMissingError reconhece a mensagem do Remotion", () => {
  assert.equal(isWebpackBundleMissingError(new Error(MISSING_BUNDLE)), true)
  assert.equal(isWebpackBundleMissingError(MISSING_BUNDLE), true)
  assert.equal(isWebpackBundleMissingError(new Error("bundle ausente — chame POST /rebundle")), false)
  assert.equal(isWebpackBundleMissingError(new Error("falha no codec")), false)
})

test("userMessageFromRenderError traduz bundle webpack ausente", () => {
  const message = userMessageFromRenderError(new Error(MISSING_BUNDLE))
  assert.match(message, /cache de render/i)
  assert.doesNotMatch(message, /Webpack/)
  assert.equal(userMessageFromRenderError(new Error("FFmpeg failed")), "FFmpeg failed")
})

test("isLocalBundleReady é false se o index.html sumiu do disco", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "bundle-missing-"))
  try {
    assert.equal(await isLocalBundleReady(dir), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("isLocalBundleReady é true quando o index.html existe", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "bundle-ready-"))
  try {
    await writeFile(path.join(dir, "index.html"), "<html></html>")
    assert.equal(await isLocalBundleReady(dir), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("isLocalBundleReady assume URL http pronta", async () => {
  assert.equal(await isLocalBundleReady("http://bundle.local"), true)
})

test("ensureServeUrl rebundleia se o caminho local não tem index.html", async () => {
  let bundled = 0
  const next = await ensureServeUrl({
    serveUrl: "/tmp/remotion-webpack-bundle-gone",
    isReady: async () => false,
    bundle: async () => {
      bundled += 1
      return "/stable/bundle"
    },
  })
  assert.equal(next, "/stable/bundle")
  assert.equal(bundled, 1)
})

test("ensureServeUrl reusa o serveUrl se o bundle ainda está no disco", async () => {
  let bundled = 0
  const next = await ensureServeUrl({
    serveUrl: "/stable/bundle",
    isReady: async () => true,
    bundle: async () => {
      bundled += 1
      return "/other"
    },
  })
  assert.equal(next, "/stable/bundle")
  assert.equal(bundled, 0)
})

test("runWithMissingBundleRetry remonta uma vez e segue", async () => {
  let runs = 0
  let recovered = 0
  const result = await runWithMissingBundleRetry({
    run: async () => {
      runs += 1
      if (runs === 1) throw new Error(MISSING_BUNDLE)
      return "ok"
    },
    recover: async () => {
      recovered += 1
    },
  })
  assert.equal(result, "ok")
  assert.equal(runs, 2)
  assert.equal(recovered, 1)
})

test("runWithMissingBundleRetry não retenta erro de codec", async () => {
  await assert.rejects(
    () =>
      runWithMissingBundleRetry({
        run: async () => {
          throw new Error("FFmpeg failed")
        },
        recover: async () => {
          throw new Error("não deveria recuperar")
        },
      }),
    /FFmpeg failed/,
  )
})

test("mkdir cria o diretório estável do bundle", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bundle-parent-"))
  const outDir = path.join(root, "remotion-bundle")
  try {
    await mkdir(outDir, { recursive: true })
    await writeFile(path.join(outDir, "index.html"), "<html></html>")
    assert.equal(await isLocalBundleReady(outDir), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
