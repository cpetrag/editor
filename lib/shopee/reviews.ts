import type { ShopeeMedia, ShopeeReview } from "./types.ts"

const BUYER_KEYS = ["user", "username", "author", "author_username", "buyer", "name", "avatar", "portrait", "author_portrait"]

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function mediaFrom(raw: Record<string, unknown>): ShopeeMedia[] {
  const media: ShopeeMedia[] = []
  const images = Array.isArray(raw.images) ? raw.images : []
  for (const image of images) {
    const url = typeof image === "string" ? image : typeof asRecord(image)?.url === "string" ? String(asRecord(image)?.url) : ""
    if (url) media.push({ type: "image", url })
  }
  const videos = Array.isArray(raw.videos) ? raw.videos : []
  for (const video of videos) {
    const record = asRecord(video)
    const url = typeof video === "string" ? video : typeof record?.url === "string" ? record.url : ""
    if (url) media.push({ type: "video", url })
  }
  const single = raw.media
  if (Array.isArray(single)) {
    for (const item of single) {
      const record = asRecord(item)
      const type = record?.type === "video" ? "video" : record?.type === "image" ? "image" : null
      const url = typeof record?.url === "string" ? record.url : ""
      if (type && url) media.push({ type, url })
    }
  }
  return media
}

function reviewTime(date: string): number {
  const parsed = Date.parse(date)
  return Number.isFinite(parsed) ? parsed : 0
}

/** 4–5 estrelas, texto com pelo menos 15 caracteres. Mídia primeiro, depois as mais recentes. Sem nome de comprador. */
export function pickReviews(input: unknown, limit = 30): ShopeeReview[] {
  const list = Array.isArray(input) ? input : []
  const picked: ShopeeReview[] = []
  for (const item of list) {
    const raw = asRecord(item)
    if (!raw) continue
    const manual = asRecord(raw.source)?.kind === "manual"
    const starsRaw = raw.stars ?? raw.rating_star ?? raw.rating
    const stars = starsRaw == null || starsRaw === "" ? null : Number(starsRaw)
    if (manual) {
      if (stars != null && !(stars >= 1 && stars <= 5)) continue
    } else if (!(stars === 4 || stars === 5)) continue
    const text = String(raw.text ?? raw.comment ?? "").replace(/\s+/g, " ").trim()
    if ([...text].length < 15) continue
    const idValue = raw.id ?? raw.cmtid ?? raw.comment_id
    const id = idValue == null ? "" : String(idValue)
    if (!id) continue
    const date = String(raw.date ?? raw.ctime ?? raw.create_time ?? "")
    const variation = String(raw.variation ?? "").trim()
    const review: ShopeeReview = {
      id,
      stars,
      text,
      date,
      media: mediaFrom(raw),
      ...(variation ? { variation } : {}),
      ...(manual ? { source: { kind: "manual" as const, pastedAt: String(asRecord(raw.source)?.pastedAt ?? date) } } : {}),
    }
    const serialized = JSON.stringify(review)
    if (BUYER_KEYS.some((key) => raw[key] != null && serialized.includes(String(raw[key])))) {
      // O texto da avaliação pode citar o próprio nome. Só bloqueamos se o nome
      // entrou como campo, não se uma palavra igual aparece no comentário.
    }
    picked.push(review)
  }
  picked.sort((a, b) => {
    const media = Number(b.media.length > 0) - Number(a.media.length > 0)
    if (media !== 0) return media
    const time = reviewTime(b.date) - reviewTime(a.date)
    if (time !== 0) return time
    return (b.stars ?? 0) - (a.stars ?? 0)
  })
  return picked.slice(0, limit).map((review) => {
    const clean: ShopeeReview = {
      id: review.id,
      stars: review.stars,
      text: review.text,
      date: review.date,
      media: review.media.map((item) => ({ type: item.type, url: item.url })),
      ...(review.source ? { source: review.source } : {}),
    }
    if (review.variation) clean.variation = review.variation
    return clean
  })
}
