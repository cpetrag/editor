import fs from "node:fs"
import path from "node:path"

export const SHOPEE_VIDEO_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile Safari/604.1"

export function shopeeVideoProxy(): string {
  return String(process.env.SHOPEE_VIDEO_PROXY || "").trim()
}

function isShareVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(String(url || ""))
    return (
      /^sv\.shopee\.com\.br$/i.test(parsed.hostname) &&
      parsed.pathname.includes("/share-video/")
    )
  } catch {
    return false
  }
}

export function resolveShareVideoUrl({
  finalUrl,
  html,
}: {
  finalUrl?: string
  html?: string
} = {}): string | null {
  try {
    if (finalUrl) {
      const parsed = new URL(String(finalUrl))
      const redir = parsed.searchParams.get("redir")
      if (redir && isShareVideoUrl(redir)) return redir
    }
  } catch {
    /* ignore */
  }

  const match = String(html || "").match(/httpUrl\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (match?.[1]) {
    const raw = match[1]
      .replace(/\\u0026/gi, "&")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"')
    if (isShareVideoUrl(raw)) return raw
  }
  return null
}

export function parseNextData(html: string): unknown {
  const match = String(html || "").match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  )
  if (!match) {
    throw new Error("__NEXT_DATA__ não encontrado (layout Shopee mudou?)")
  }
  try {
    return JSON.parse(match[1] ?? "")
  } catch {
    throw new Error("__NEXT_DATA__ inválido (JSON)")
  }
}

interface ShopeeNextData {
  props?: {
    pageProps?: {
      query?: { postId?: string }
      mediaInfo?: {
        video?: {
          watermarkVideoUrl?: string
          caption?: string
          hashtagContent?: unknown
          duration?: number
          watermarkCoverUrl?: string
        }
        count?: { likeCount?: number; commentCount?: number }
        userInfo?: { videoUserName?: string }
      }
    }
  }
  query?: { postId?: string }
}

export interface ShopeeMediaInfo {
  videoUrl: string
  caption: string | null
  hashtags: string[]
  author: string | null
  likes: number | null
  comments: number | null
  durationMs: number | null
  coverUrl: string | null
  postId: string | null
  canonicalUrl: string | null
}

export function extractMediaInfo(nextData: unknown): ShopeeMediaInfo {
  const data = (nextData ?? {}) as ShopeeNextData
  const pageProps = data.props?.pageProps ?? {}
  const mediaInfo = pageProps.mediaInfo ?? {}
  const video = mediaInfo.video ?? {}
  const count = mediaInfo.count ?? {}
  const user = mediaInfo.userInfo ?? {}
  const postId = pageProps.query?.postId ?? data.query?.postId ?? null

  if (!video.watermarkVideoUrl) {
    throw new Error("URL do vídeo não encontrada")
  }

  return {
    videoUrl: video.watermarkVideoUrl,
    caption: video.caption ?? null,
    hashtags: Array.isArray(video.hashtagContent)
      ? video.hashtagContent.filter((item): item is string => typeof item === "string")
      : [],
    author: user.videoUserName ?? null,
    likes: count.likeCount ?? null,
    comments: count.commentCount ?? null,
    durationMs: video.duration ?? null,
    coverUrl: video.watermarkCoverUrl ?? null,
    postId,
    canonicalUrl: postId ? `https://sv.shopee.com.br/share-video/${postId}` : null,
  }
}

async function assertOk(res: Response | null | undefined, label: string): Promise<void> {
  if (!res || res.ok === false) {
    const status = res?.status != null ? String(res.status) : "?"
    throw new Error(`${label} HTTP ${status}`.slice(0, 500))
  }
}

export interface ShopeeDownloadResult {
  title: string
  watermarked: true
  videoUrl: string
  caption: string | null
  hashtags: string[]
  author: string | null
  likes: number | null
  comments: number | null
  durationMs: number | null
  coverUrl: string | null
  postId: string | null
  canonicalUrl: string | null
  arquivo: string
}

export async function downloadShopeeVideo({
  shareUrl,
  destMp4,
  fetchImpl,
  proxy,
}: {
  shareUrl: string
  destMp4: string
  fetchImpl?: typeof fetch
  proxy?: string
}): Promise<ShopeeDownloadResult> {
  const proxyUrl = proxy !== undefined ? String(proxy || "").trim() : shopeeVideoProxy()
  if (proxyUrl) {
    throw new Error("SHOPEE_VIDEO_PROXY configurado mas agente de proxy indisponível")
  }

  const doFetch = fetchImpl || globalThis.fetch
  if (typeof doFetch !== "function") {
    throw new Error("fetch indisponível")
  }

  const headers = { "User-Agent": SHOPEE_VIDEO_UA }
  let htmlRes = await doFetch(shareUrl, { headers, redirect: "follow" })
  await assertOk(htmlRes, "share page")
  let html = await htmlRes.text()
  const finalUrl = htmlRes.url || shareUrl

  if (!String(html).includes("__NEXT_DATA__")) {
    const resolved = resolveShareVideoUrl({ finalUrl, html })
    if (!resolved) {
      throw new Error(
        "__NEXT_DATA__ não encontrado (layout Shopee mudou? ou universal-link sem redir)",
      )
    }
    htmlRes = await doFetch(resolved, { headers, redirect: "follow" })
    await assertOk(htmlRes, "share-video page")
    html = await htmlRes.text()
  }

  const info = extractMediaInfo(parseNextData(html))

  const mp4Res = await doFetch(info.videoUrl, { headers, redirect: "follow" })
  await assertOk(mp4Res, "mp4")
  const buf = Buffer.from(await mp4Res.arrayBuffer())
  fs.mkdirSync(path.dirname(destMp4), { recursive: true })
  fs.writeFileSync(destMp4, buf)

  const title =
    String(info.caption || info.postId || "shopee-video").slice(0, 200) || "shopee-video"

  return {
    title,
    watermarked: true,
    videoUrl: info.videoUrl,
    caption: info.caption,
    hashtags: info.hashtags,
    author: info.author,
    likes: info.likes,
    comments: info.comments,
    durationMs: info.durationMs,
    coverUrl: info.coverUrl,
    postId: info.postId,
    canonicalUrl: info.canonicalUrl,
    arquivo: destMp4,
  }
}
