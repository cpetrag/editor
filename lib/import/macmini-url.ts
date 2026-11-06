/** Catálogo Shopee Vídeos publicado pelo Mac Mini via Cloudflare. Sem fs: a allowlist roda no browser. */
export const MACMINI_CATALOG_HOST = "shopeevideos.macmini-capture.cc"
export const MACMINI_CATALOG_ORIGIN = `https://${MACMINI_CATALOG_HOST}`

const VIDEO_PATH = /^\/media\/([a-z0-9]{4,32})\/video\.mp4$/i

export function macminiCatalogVideo(raw: string): { id: string; href: string } | null {
  let parsed: URL
  try {
    parsed = new URL(String(raw || "").trim())
  } catch {
    return null
  }
  if (parsed.protocol !== "https:") return null
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase()
  if (host !== MACMINI_CATALOG_HOST) return null
  const id = parsed.pathname.match(VIDEO_PATH)?.[1]?.toLowerCase()
  if (!id) return null
  return { id, href: `${MACMINI_CATALOG_ORIGIN}/media/${id}/video.mp4` }
}
