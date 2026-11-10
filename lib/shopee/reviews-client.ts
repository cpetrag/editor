import type { FeedFacts } from "./feed.ts"
import { canonicalShopeeUrl } from "./url.ts"

export type ReviewBundle = {
  reviews: unknown[]
  facts: FeedFacts
}

function unwrapAsset(url: string, studio: string): string {
  try {
    const base = url.startsWith("/") ? new URL(url, studio) : new URL(url)
    const embedded = base.searchParams.get("u")
    if (embedded && /^https?:\/\//i.test(embedded)) return embedded
    if (url.startsWith("/")) return new URL(url, studio).href
    return url
  } catch {
    return url
  }
}

function rewriteReviews(reviews: unknown[], studio: string): unknown[] {
  return reviews.map((item) => {
    if (!item || typeof item !== "object") return item
    const row = item as Record<string, unknown>
    const images = Array.isArray(row.images)
      ? row.images.map((image) => (typeof image === "string" ? unwrapAsset(image, studio) : image))
      : row.images
    const videos = Array.isArray(row.videos)
      ? row.videos.map((video) => {
          if (!video || typeof video !== "object") return video
          const media = video as Record<string, unknown>
          return {
            ...media,
            ...(typeof media.url === "string" ? { url: unwrapAsset(media.url, studio) } : {}),
          }
        })
      : row.videos
    return { ...row, images, videos }
  })
}

function causeOf(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("cause" in error)) return undefined
  return (error as { cause?: unknown }).cause
}

function errorCode(error: unknown): string {
  const cause = causeOf(error)
  const direct = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined
  const nested = cause && typeof cause === "object" && "code" in cause ? (cause as { code?: unknown }).code : undefined
  const code = typeof nested === "string" ? nested : typeof direct === "string" ? direct : ""
  return code.trim()
}

function portOf(endpoint: string): string {
  try {
    return new URL(endpoint).port
  } catch {
    return ""
  }
}

/** Resposta HTTP do worker, distinta de não conseguir abrir a porta. */
export function workerHttpError(status: number, message: string, endpoint: string): string {
  let port = ""
  let path = ""
  try {
    const url = new URL(endpoint)
    port = url.port
    path = url.pathname
  } catch {
    port = ""
    path = ""
  }
  const worker = port === "3019" || path === "/reviews"
  if (!worker) return message
  return `worker: ${status} ${message}`.trim()
}

/** A mensagem do fetch esconde o motivo. O código fica em err.cause. */
export function describeFetchError(error: unknown, endpoint: string): string {
  const code = errorCode(error)
  const cause = causeOf(error)
  const port = portOf(endpoint)
  console.error("[shopee] reviews", endpoint, {
    message: error instanceof Error ? error.message : String(error),
    code: code || null,
    cause: cause instanceof Error ? cause.message : cause ?? null,
  })
  if (code === "ECONNREFUSED") return `porta ${port || "?"} recusou (${code})`
  if (code === "ENOTFOUND") return `servidor não encontrado (${code})`
  if (code === "ECONNRESET") return `conexão interrompida (${code})`
  if (code && /CERT|TLS|UNABLE_TO_VERIFY/i.test(code)) return `certificado recusado (${code})`
  if (code) return code
  if (cause instanceof Error && cause.message && cause.message !== "fetch failed") return cause.message
  if (error instanceof Error && error.message && error.message !== "fetch failed") return error.message
  return "fetch failed"
}

export function reviewsEndpoints(): { worker: string; studio: string } {
  const worker = (process.env.REVIEWS_WORKER_URL || "http://127.0.0.1:3019").replace(/\/$/, "")
  const studio = (
    process.env.REVIEWS_STUDIO_URL ||
    process.env.STUDIO_PUBLIC_BASE_URL ||
    "https://reviews.macmini-capture.cc"
  ).replace(/\/$/, "")
  return { worker: `${worker}/reviews`, studio: `${studio}/api/reviews` }
}

async function postReviews(endpoint: string, productUrl: string): Promise<{ bundle: ReviewBundle | null; error?: string }> {
  console.log("[shopee] reviews", endpoint)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: productUrl, limit: 40, filter: "0" }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    return { bundle: null, error: describeFetchError(error, endpoint) }
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || typeof json.error === "string") {
    const detail = typeof json.error === "string" && json.error.trim() ? json.error.trim() : `HTTP ${response.status}`
    const message = workerHttpError(response.status, detail, endpoint)
    console.error("[shopee] reviews", endpoint, message)
    return { bundle: null, error: message }
  }
  const reviews = Array.isArray(json.reviews) ? json.reviews : []
  const summary = json.summary && typeof json.summary === "object" ? (json.summary as Record<string, unknown>) : {}
  const rating = typeof summary.media === "number" ? summary.media : null
  const sold = typeof summary.sold === "number" ? summary.sold : null
  const title = typeof json.productName === "string" ? json.productName : ""
  const image = typeof json.productImage === "string" ? json.productImage : ""
  const studio = endpoint.includes("/api/reviews") ? endpoint.replace(/\/api\/reviews$/, "") : "https://reviews.macmini-capture.cc"
  return {
    bundle: {
      reviews: rewriteReviews(reviews, studio),
      facts: {
        ...(title ? { title } : {}),
        ...(rating != null ? { rating } : {}),
        ...(sold != null ? { sold } : {}),
        ...(image ? { images: [unwrapAsset(image, studio)] } : {}),
      },
    },
  }
}

export async function readReviewBundle(shopId: string, itemId: string): Promise<{ bundle: ReviewBundle | null; error?: string }> {
  const productUrl = canonicalShopeeUrl({ shopId, itemId })
  const endpoints = reviewsEndpoints()
  const worker = await postReviews(endpoints.worker, productUrl)
  if (worker.bundle) return worker
  const studio = await postReviews(endpoints.studio, productUrl)
  if (studio.bundle) return studio
  return { bundle: null, error: worker.error || studio.error || "avaliações indisponíveis" }
}
