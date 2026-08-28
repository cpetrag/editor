import { formatSeconds } from "../parse-decimal.ts"

export type ExportExtension = "mp4" | "webm"

export interface ExportFormat {
  mime: string
  ext: ExportExtension
  label: "MP4" | "WebM"
}

export const EXPORT_CANDIDATES: ExportFormat[] = [
  { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4", label: "MP4" },
  { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4", label: "MP4" },
  { mime: "video/mp4;codecs=avc1", ext: "mp4", label: "MP4" },
  { mime: "video/mp4", ext: "mp4", label: "MP4" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm", label: "WebM" },
  { mime: "video/webm;codecs=vp8,opus", ext: "webm", label: "WebM" },
  { mime: "video/webm", ext: "webm", label: "WebM" },
]

function defaultIsSupported(mime: string): boolean {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)
}

export function pickExportFormat(
  isSupported: (mime: string) => boolean = defaultIsSupported,
): ExportFormat {
  const chosen = EXPORT_CANDIDATES.find((candidate) => isSupported(candidate.mime))
  if (!chosen) {
    throw new Error("Este navegador não suporta gravação de vídeo.")
  }
  return chosen
}

export function tryPickExportFormat(
  isSupported: (mime: string) => boolean = defaultIsSupported,
): ExportFormat | null {
  try {
    return pickExportFormat(isSupported)
  } catch {
    return null
  }
}

export function extensionFromMime(mime: string): ExportExtension {
  return mime.startsWith("video/webm") ? "webm" : "mp4"
}

export function blobTypeFromMime(mime: string): string {
  return mime.split(";")[0] ?? mime
}

export function outputFps(fps: number): number {
  return fps >= 24 && fps <= 60 ? fps : 30
}

export function formatExportSpec(
  width: number,
  height: number,
  fps: number,
  label: string,
  duration: number,
): string {
  return `${width}×${height} · ${outputFps(fps)}fps · ${label} · ~${formatSeconds(duration)}s`
}
