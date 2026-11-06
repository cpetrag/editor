import fs from "node:fs"
import path from "node:path"

import {
  MACMINI_CATALOG_HOST,
  MACMINI_CATALOG_ORIGIN,
  macminiCatalogVideo,
} from "./macmini-url.ts"

export { MACMINI_CATALOG_HOST, MACMINI_CATALOG_ORIGIN, macminiCatalogVideo } from "./macmini-url.ts"

/** Mesmo teto do editor: acima disso o navegador não processa o arquivo. */
export const MACMINI_VIDEO_MAX_BYTES = 200 * 1024 * 1024

interface CatalogItem {
  code?: string
  product_name?: string
  hook?: string
  caption?: string
  likes?: number
  comments?: number
  link?: string
  thumb?: string
}

export interface MacminiDownloadResult {
  title: string
  code: string
  videoUrl: string
  likes: number | null
  comments: number | null
  canonicalUrl: string | null
  coverUrl: string | null
  arquivo: string
}

function headerValue(res: Response, name: string): string | null {
  return res.headers?.get(name) ?? null
}

/**
 * Só segue redirect se o destino continuar no host do catálogo.
 * O id veio da URL colada; o fetch nunca usa um host escolhido pelo usuário.
 */
async function fetchCatalog(
  url: string,
  fetchImpl: typeof fetch,
  label: string,
): Promise<Response> {
  let current = url
  for (let hop = 0; hop < 3; hop += 1) {
    const res = await fetchImpl(current, { redirect: "manual" })
    const status = res.status
    if (status >= 300 && status < 400) {
      const location = headerValue(res, "location")
      if (!location) throw new Error(`${label} redirect sem destino`)
      const next = new URL(location, current)
      const nextHost = next.hostname.replace(/\.$/, "").toLowerCase()
      if (next.protocol !== "https:" || nextHost !== MACMINI_CATALOG_HOST) {
        throw new Error(`${label} redirect fora do catálogo`)
      }
      current = next.href
      continue
    }
    if (!res.ok) throw new Error(`${label} HTTP ${status}`)
    return res
  }
  throw new Error(`${label} redirects demais`)
}

function assertMp4Response(res: Response): void {
  const type = (headerValue(res, "content-type") || "").toLowerCase()
  if (type.includes("text/html") || type.includes("application/json") || type.startsWith("text/")) {
    throw new Error("resposta não é vídeo")
  }
  const length = Number(headerValue(res, "content-length") || "0")
  if (Number.isFinite(length) && length > MACMINI_VIDEO_MAX_BYTES) {
    throw new Error("vídeo grande demais")
  }
}

function catalogTitle(item: CatalogItem | null, id: string): string {
  const raw = item?.product_name || item?.hook || item?.caption || id
  const title = String(raw).replace(/\s+/g, " ").trim().slice(0, 200)
  return title || id
}

function shopeeLink(raw: unknown): string | null {
  try {
    const url = new URL(String(raw || ""))
    if (url.protocol !== "https:") return null
    const host = url.hostname.replace(/\.$/, "").toLowerCase()
    if (host === "br.shp.ee" || host === "shp.ee" || host === "sv.shopee.com.br") return url.href
  } catch {
    return null
  }
  return null
}

function coverUrl(item: CatalogItem | null): string | null {
  const thumb = String(item?.thumb || "").trim()
  if (!/^[a-z0-9]{4,32}\/thumb\.(jpg|jpeg|webp)$/i.test(thumb)) return null
  return `${MACMINI_CATALOG_ORIGIN}/media/${thumb}`
}

async function lookupItem(id: string, fetchImpl: typeof fetch): Promise<CatalogItem | null> {
  try {
    const res = await fetchCatalog(`${MACMINI_CATALOG_ORIGIN}/data.json`, fetchImpl, "catálogo")
    const data = (await res.json()) as { items?: unknown }
    const items = Array.isArray(data.items) ? data.items : []
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue
      const item = raw as CatalogItem
      if (String(item.code || "").toLowerCase() === id) return item
    }
  } catch (error) {
    console.error(
      "[import/macmini] catálogo",
      error instanceof Error ? error.message : "falha ao ler data.json",
    )
  }
  return null
}

export async function downloadMacminiVideo({
  pageUrl,
  destMp4,
  fetchImpl,
}: {
  pageUrl: string
  destMp4: string
  fetchImpl?: typeof fetch
}): Promise<MacminiDownloadResult> {
  const video = macminiCatalogVideo(pageUrl)
  if (!video) throw new Error("não é um vídeo")

  const doFetch = fetchImpl || globalThis.fetch
  if (typeof doFetch !== "function") throw new Error("fetch indisponível")

  let mp4Res = await fetchCatalog(video.href, doFetch, "mp4")
  const type = (headerValue(mp4Res, "content-type") || "").toLowerCase()
  if (type.includes("text/html")) {
    mp4Res = await fetchCatalog(`${video.href}?download=1`, doFetch, "mp4")
  }
  assertMp4Response(mp4Res)

  const buf = Buffer.from(await mp4Res.arrayBuffer())
  if (buf.byteLength === 0) throw new Error("mp4 vazio")
  if (buf.byteLength > MACMINI_VIDEO_MAX_BYTES) throw new Error("vídeo grande demais")

  const item = await lookupItem(video.id, doFetch)
  fs.mkdirSync(path.dirname(destMp4), { recursive: true })
  fs.writeFileSync(destMp4, buf)

  return {
    title: catalogTitle(item, video.id),
    code: video.id,
    videoUrl: video.href,
    likes: typeof item?.likes === "number" ? item.likes : null,
    comments: typeof item?.comments === "number" ? item.comments : null,
    canonicalUrl: shopeeLink(item?.link),
    coverUrl: coverUrl(item),
    arquivo: destMp4,
  }
}
