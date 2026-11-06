import { MACMINI_CATALOG_HOST, macminiCatalogVideo } from "./macmini-url.ts"

export type ImportPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest"
  | "x"
  | "shopee-video"
  | "macmini-catalog"

export type ParsedImportUrl =
  | { ok: true; platform: ImportPlatform; href: string; host: string }
  | { ok: false; error: string }

const HOST_PLATFORM: Array<[RegExp, ImportPlatform]> = [
  [/^(www\.|m\.)?youtube\.com$/i, "youtube"],
  [/^youtu\.be$/i, "youtube"],
  [/^(www\.|vm\.|vt\.|m\.)?tiktok\.com$/i, "tiktok"],
  [/^(www\.)?instagram\.com$/i, "instagram"],
  [/^(www\.|m\.|web\.)?facebook\.com$/i, "facebook"],
  [/^fb\.watch$/i, "facebook"],
  [/^([a-z0-9-]+\.)?pinterest\.com$/i, "pinterest"],
  [/^pin\.it$/i, "pinterest"],
  [/^(www\.)?x\.com$/i, "x"],
  [/^(www\.)?twitter\.com$/i, "x"],
  [/^(br\.)?shp\.ee$/i, "shopee-video"],
  [/^sv\.shopee\.com\.br$/i, "shopee-video"],
]

export function parseAllowedImportUrl(raw: unknown): ParsedImportUrl {
  let parsed: URL
  try {
    parsed = new URL(String(raw || "").trim())
  } catch {
    return { ok: false, error: "URL inválida" }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL inválida" }
  }
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase()
  if (host === MACMINI_CATALOG_HOST) {
    if (parsed.protocol !== "https:") return { ok: false, error: "URL inválida" }
    const video = macminiCatalogVideo(parsed.href)
    if (!video) return { ok: false, error: "não é um vídeo" }
    return { ok: true, platform: "macmini-catalog", href: video.href, host }
  }
  for (const [pattern, platform] of HOST_PLATFORM) {
    if (pattern.test(host)) {
      return { ok: true, platform, href: parsed.href, host }
    }
  }
  return {
    ok: false,
    error:
      "host não permitido (só YouTube, TikTok, Instagram, Facebook, Pinterest, X, Shopee Video e o catálogo do Mac Mini)",
  }
}
