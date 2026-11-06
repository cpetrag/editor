import type { CompositionSource } from "./composition.ts"
import { parseAllowedImportUrl } from "./import/allowlist.ts"
import type { ImportErrorCode } from "./import-errors.ts"
import { formatTime } from "./inserts.ts"

const TRACKING_PARAMS = new Set([
  "is_from_webapp",
  "sender_device",
  "web_id",
  "igsh",
  "si",
])

export function canonicalizeImportUrl(raw: string): string {
  try {
    const parsed = new URL(raw.trim())
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key)
      }
    }
    parsed.hash = ""
    return parsed.toString().replace(/\/$/, "").replace(/\?$/, "")
  } catch {
    return raw.trim()
  }
}

export function authorFromImportUrl(raw: string): string | undefined {
  try {
    const parsed = new URL(raw.trim())
    const host = parsed.hostname.replace(/^www\./i, "")
    const parts = parsed.pathname.split("/").filter(Boolean)
    if (host.endsWith("tiktok.com")) {
      const handle = parts.find((part) => part.startsWith("@"))
      return handle || undefined
    }
    if (host.endsWith("instagram.com") && parts[0] && !isInstagramMediaSegment(parts[0])) {
      return `@${parts[0]}`
    }
  } catch {
    return undefined
  }
  return undefined
}

function isInstagramMediaSegment(segment: string): boolean {
  return /^(reel|reels|p|tv|stories)$/i.test(segment)
}

export function classifyImportUrl(
  raw: string,
): { ok: true } | { ok: false; code: ImportErrorCode } {
  const parsed = parseAllowedImportUrl(raw)
  if (!parsed.ok) {
    if (/não é um vídeo|not a video/i.test(parsed.error)) {
      return { ok: false, code: "NOT_A_VIDEO" }
    }
    return { ok: false, code: "UNSUPPORTED" }
  }
  try {
    const url = new URL(parsed.href)
    const host = url.hostname.replace(/^www\./i, "").toLowerCase()
    const path = url.pathname
    if (host.endsWith("tiktok.com")) {
      if (/^(vm|vt|m)\.tiktok\.com$/i.test(url.hostname)) return { ok: true }
      if (/\/(video|photo)\//i.test(path)) return { ok: true }
      return { ok: false, code: "NOT_A_VIDEO" }
    }
    if (host.endsWith("instagram.com")) {
      if (/\/(reel|reels|p|tv)\//i.test(path)) return { ok: true }
      return { ok: false, code: "NOT_A_VIDEO" }
    }
    if (host === "youtu.be") return { ok: true }
    if (host.endsWith("youtube.com")) {
      if (/\/(watch|shorts|embed|live)\b/i.test(path) || url.searchParams.has("v")) return { ok: true }
      return { ok: false, code: "NOT_A_VIDEO" }
    }
    if (host.endsWith("facebook.com") || host === "fb.watch") {
      if (host === "fb.watch") return { ok: true }
      if (/\/(watch|videos|reel|reels)\b/i.test(path) || url.searchParams.has("v")) return { ok: true }
      return { ok: false, code: "NOT_A_VIDEO" }
    }
    if (host.endsWith("pinterest.com") || host === "pin.it") return { ok: true }
    if (host === "x.com" || host === "twitter.com") {
      if (/\/status\//i.test(path)) return { ok: true }
      return { ok: false, code: "NOT_A_VIDEO" }
    }
    if (host.endsWith("shp.ee") || host === "sv.shopee.com.br") return { ok: true }
    if (host === "shopeevideos.macmini-capture.cc") return { ok: true }
  } catch {
    return { ok: false, code: "UNSUPPORTED" }
  }
  return { ok: true }
}

export function sourceKind(source: CompositionSource): "file" | "url" {
  return source.remoteUrl || source.canonicalUrl ? "url" : "file"
}

export function sourceHeadline(source: CompositionSource): string {
  const author = source.author?.trim()
  const title = source.title?.trim()
  if (author && title) return `${author} · ${title}`
  if (author) return author
  if (title) return title
  if (source.canonicalUrl) return source.canonicalUrl
  if (source.remoteUrl) return source.remoteUrl
  return source.fileName || "Vídeo de fundo"
}

export function sourceTechLine(source: CompositionSource): string {
  return `${formatTime(source.duration)} · ${source.width}×${source.height} · ${Math.round(source.fps)}fps`
}

export function shortenCanonicalUrl(canonicalUrl: string): string {
  try {
    const parsed = new URL(canonicalUrl)
    const author = authorFromImportUrl(canonicalUrl)
    const parts = parsed.pathname.split("/").filter(Boolean)
    const videoId = parts[parts.length - 1] ?? ""
    if (author && videoId) {
      const shortId = videoId.length > 6 ? `${videoId.slice(0, 4)}…` : videoId
      return `${author}/video/${shortId}`
    }
    const host = parsed.hostname.replace(/^www\./, "")
    const path = parsed.pathname.length > 24 ? `${parsed.pathname.slice(0, 22)}…` : parsed.pathname
    return `${host}${path}`
  } catch {
    return canonicalUrl
  }
}

export function importElapsedLabel(
  jobStatus: "queued" | "running",
  elapsedSeconds: number,
): string {
  const seconds = Math.max(0, Math.floor(elapsedSeconds))
  if (jobStatus === "queued") return `Na fila… ${seconds}s`
  return `Baixando… ${seconds}s`
}

export function providerLabel(provider: string | undefined): string | null {
  switch (provider) {
    case "tiktok":
      return "TikTok"
    case "youtube":
      return "YouTube"
    case "instagram":
      return "Instagram"
    case "facebook":
      return "Facebook"
    case "pinterest":
      return "Pinterest"
    case "x":
      return "X"
    case "shopee-video":
      return "Shopee Video"
    case "macmini-catalog":
      return "Catálogo"
    default:
      return provider ? provider : null
  }
}
