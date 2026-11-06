import { access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")

/** Fora de /var/folders: o temp do macOS some com o PM2 ainda no ar. */
export const DEFAULT_BUNDLE_OUT_DIR = path.join(PROJECT_ROOT, "tmp", "remotion-bundle")

export function webpackBundleIndex(serveUrl: string): string | null {
  const trimmed = serveUrl.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return null
  return path.join(trimmed, "index.html")
}

export function isWebpackBundleMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Tried to serve the Webpack bundle") ||
    message.includes("Is this a valid path to a Webpack bundle")
  )
}

export async function isLocalBundleReady(serveUrl: string): Promise<boolean> {
  const index = webpackBundleIndex(serveUrl)
  if (index === null) return serveUrl.trim().length > 0
  try {
    await access(index)
    return true
  } catch {
    return false
  }
}

export async function ensureServeUrl(input: {
  serveUrl: string
  isReady: (serveUrl: string) => Promise<boolean>
  bundle: () => Promise<string>
}): Promise<string> {
  if (await input.isReady(input.serveUrl)) return input.serveUrl
  return input.bundle()
}

export async function runWithMissingBundleRetry<T>(input: {
  run: () => Promise<T>
  recover: () => Promise<void>
}): Promise<T> {
  try {
    return await input.run()
  } catch (error) {
    if (!isWebpackBundleMissingError(error)) throw error
    await input.recover()
    return input.run()
  }
}

export function userMessageFromRenderError(error: unknown): string {
  if (isWebpackBundleMissingError(error)) {
    return "O cache de render no Mac sumiu. Tente exportar de novo."
  }
  return error instanceof Error ? error.message : "falha no render"
}
