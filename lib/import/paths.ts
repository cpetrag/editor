import fs from "node:fs"
import path from "node:path"

export function downloadDir(): string {
  const fromEnv = String(process.env.IMPORT_DOWNLOAD_DIR || "").trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(process.cwd(), "data", "import-downloads")
}

export function jobsDir(): string {
  return path.join(downloadDir(), ".jobs")
}

export function ensureImportDirs(): void {
  fs.mkdirSync(downloadDir(), { recursive: true })
  fs.mkdirSync(jobsDir(), { recursive: true })
}
