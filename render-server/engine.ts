import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { bundle, type WebpackOverrideFn } from "@remotion/bundler"
import { makeCancelSignal, renderMedia, selectComposition } from "@remotion/renderer"

import type { RenderEngine } from "./app.ts"
import {
  DEFAULT_BUNDLE_OUT_DIR,
  ensureServeUrl,
  isLocalBundleReady,
  runWithMissingBundleRetry,
} from "./bundle-cache.ts"

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

const webpackOverride: WebpackOverrideFn = (current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".ts": [".ts", ".tsx"],
      ".tsx": [".tsx"],
    },
    alias: {
      ...(typeof current.resolve?.alias === "object" && current.resolve.alias
        ? current.resolve.alias
        : {}),
      "@": PROJECT_ROOT,
    },
  },
})

export function createRemotionEngine(): RenderEngine {
  let serveUrl = ""

  async function rebuild(): Promise<string> {
    await mkdir(path.dirname(DEFAULT_BUNDLE_OUT_DIR), { recursive: true })
    serveUrl = await bundle({
      entryPoint: path.join(PROJECT_ROOT, "remotion/index.ts"),
      publicDir: path.join(PROJECT_ROOT, "public"),
      outDir: DEFAULT_BUNDLE_OUT_DIR,
      webpackOverride,
    })
    return serveUrl
  }

  return {
    async bundle() {
      await rebuild()
      return { serveUrl, version: new Date().toISOString() }
    },
    async render({ inputProps, outputLocation, onProgress, signal }) {
      serveUrl = await ensureServeUrl({
        serveUrl,
        isReady: isLocalBundleReady,
        bundle: rebuild,
      })
      if (!serveUrl) {
        throw new Error("bundle ausente — chame POST /rebundle")
      }
      const { cancel, cancelSignal } = makeCancelSignal()
      const abort = () => cancel()
      signal.addEventListener("abort", abort, { once: true })
      try {
        await runWithMissingBundleRetry({
          recover: async () => {
            serveUrl = ""
            await rebuild()
          },
          run: async () => {
            onProgress({ progress: 0 })
            const composition = await selectComposition({
              serveUrl,
              id: "Short",
              inputProps,
            })
            onProgress({ progress: 0.02 })
            await renderMedia({
              composition,
              serveUrl,
              inputProps,
              codec: "h264",
              outputLocation,
              concurrency: 3,
              crf: 18,
              imageFormat: "jpeg",
              chromiumOptions: { gl: "angle" },
              cancelSignal,
              onProgress: ({ progress }) => {
                onProgress({ progress })
              },
            })
          },
        })
      } finally {
        signal.removeEventListener("abort", abort)
      }
    },
  }
}
