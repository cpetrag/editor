import path from "node:path"

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/g
const KNOWN_VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i

export const DEFAULT_CAPCUT_DIR_MAC =
  "/Volumes/HD 1Tb/Vibecoding/Shopee Reviews/CapCut"
export const DEFAULT_CAPCUT_DIR_WIN = "N:\\Vibecoding\\Shopee Reviews\\CapCut"

export function resolveCapcutDir(
  env: Record<string, string | undefined> = {},
  platform: NodeJS.Platform = process.platform,
): string {
  const fromEnv = env.CAPCUT_HD_SOURCE?.trim()
  if (fromEnv) return fromEnv
  return platform === "win32" ? DEFAULT_CAPCUT_DIR_WIN : DEFAULT_CAPCUT_DIR_MAC
}

export function sanitizeExportStem(fileName: string): string {
  const base = path.basename(String(fileName || "").replace(/\\/g, "/"))
  const withoutExt = base.replace(KNOWN_VIDEO_EXT, "").replace(/\.[^.]+$/, "")
  const cleaned = withoutExt.replace(FORBIDDEN, " ").replace(/\s+/g, " ").trim().slice(0, 80)
  return cleaned || "video"
}

export function sanitizeCapcutFileName(fileName: string): string {
  return `${sanitizeExportStem(fileName)}.mp4`
}

export function exportDiskFileName(fileName: string, ext: "mp4" | "webm"): string {
  return `${sanitizeExportStem(fileName)}.${ext}`
}

export function isInsideCapcutDir(dir: string, filePath: string): boolean {
  const parent = path.resolve(dir)
  const child = path.resolve(filePath)
  const relative = path.relative(parent, child)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

export function uniqueCapcutDest(
  destDir: string,
  fileName: string,
  exists: (fullPath: string) => boolean,
): string {
  const safe = path.basename(fileName)
  const ext = path.extname(safe) || ".mp4"
  const stem = safe.slice(0, Math.max(0, safe.length - ext.length)) || "video_export"
  let candidate = path.join(destDir, `${stem}${ext}`)
  let index = 2
  while (exists(candidate)) {
    candidate = path.join(destDir, `${stem}-${index}${ext}`)
    index += 1
  }
  if (!isInsideCapcutDir(destDir, candidate)) {
    throw new Error("destino CapCut inválido")
  }
  return candidate
}
