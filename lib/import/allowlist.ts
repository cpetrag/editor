export type ImportPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "pinterest"
  | "x"
  | "shopee-video"

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
  const host = parsed.hostname.replace(/\.$/, "")
  for (const [pattern, platform] of HOST_PLATFORM) {
    if (pattern.test(host)) {
      return { ok: true, platform, href: parsed.href, host }
    }
  }
  return {
    ok: false,
    error:
      "host não permitido (só YouTube, TikTok, Instagram, Facebook, Pinterest, X, Shopee Video)",
  }
}
