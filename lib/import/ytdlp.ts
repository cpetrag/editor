import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { parseAllowedImportUrl } from "./allowlist.ts"

/** Chrome 140 — TikTok recusa o UA padrão do yt-dlp com "Unexpected response from webpage request". */
export const TIKTOK_CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

export function ytdlpBin(): string {
  return String(process.env.YTDLP_PATH || "").trim() || "yt-dlp"
}

export function isRetryableExtractorError(message: string): boolean {
  return /universal data for rehydration|unexpected response from webpage request|no impersonate target is available/i.test(
    message,
  )
}

export async function withExtractorRetries<T>(
  run: () => Promise<T>,
  {
    attempts = 3,
    delayMs = 1500,
    sleep: sleepFn = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    isRetryable = isRetryableExtractorError,
  }: {
    attempts?: number
    delayMs?: number
    sleep?: (ms: number) => Promise<void>
    isRetryable?: (message: string) => boolean
  } = {},
): Promise<T> {
  let lastError: Error | undefined
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleepFn(delayMs)
    try {
      return await run()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i === attempts - 1 || !isRetryable(lastError.message)) throw lastError
    }
  }
  throw lastError ?? new Error("yt-dlp retry exhausted")
}

/**
 * Default is direct (no proxy). Production on the Mac Mini needs residential
 * egress — SOCKS via Hostinger timed out YouTube. Set IMPORT_PROXY to a URL
 * to opt in.
 */
export function importProxy(): string {
  const proxy = String(process.env.IMPORT_PROXY || "").trim()
  if (!proxy) return ""
  const lower = proxy.toLowerCase()
  if (lower === "off" || lower === "none" || lower === "direct") return ""
  return proxy
}

export function buildYtDlpArgs({
  url,
  outTemplate,
  proxy,
}: {
  url: string
  outTemplate: string
  proxy?: string
}): string[] {
  const args = [
    "--no-playlist",
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "-o",
    outTemplate,
    "--print",
    "after_move:%(filepath)s",
    "--print",
    "before_dl:%(title)s",
    "--no-progress",
  ]
  const parsed = parseAllowedImportUrl(url)
  if (parsed.ok && parsed.platform === "tiktok") {
    args.push("--user-agent", TIKTOK_CHROME_USER_AGENT)
  }
  if (proxy) args.push("--proxy", proxy)
  args.push("--", url)
  return args
}

function runYtDlpOnce({
  url,
  destMp4,
  timeoutMs = 15 * 60 * 1000,
}: {
  url: string
  destMp4: string
  timeoutMs?: number
}): Promise<{ path: string; title: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destMp4)
    const base = path.join(dir, path.basename(destMp4, ".mp4"))
    const outTemplate = `${base}.%(ext)s`
    const args = buildYtDlpArgs({ url, outTemplate, proxy: importProxy() })
    const child = spawn(ytdlpBin(), args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error("yt-dlp timeout"))
    }, timeoutMs)
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        const message =
          stderr.trim().split("\n").slice(-8).join(" ") || `yt-dlp exit ${code}`
        reject(new Error(message.slice(0, 500)))
        return
      }
      let finalPath = destMp4
      if (!fs.existsSync(finalPath)) {
        const candidate = fs
          .readdirSync(dir)
          .find(
            (name) =>
              name.startsWith(`${path.basename(base)}.`) && !name.endsWith(".meta.json"),
          )
        if (candidate) finalPath = path.join(dir, candidate)
      }
      if (!fs.existsSync(finalPath)) {
        reject(new Error("yt-dlp não gerou arquivo"))
        return
      }
      if (finalPath !== destMp4) {
        fs.renameSync(finalPath, destMp4)
      }
      const titleLine =
        stdout
          .trim()
          .split("\n")
          .find((line) => line && !line.endsWith(".mp4") && !line.includes(path.sep)) || ""
      resolve({ path: destMp4, title: titleLine.slice(0, 200), stderr })
    })
  })
}

export function runYtDlp(opts: {
  url: string
  destMp4: string
  timeoutMs?: number
}): Promise<{ path: string; title: string; stderr: string }> {
  return withExtractorRetries(() => runYtDlpOnce(opts))
}
