import type { ShopeeProduct, ShopeeReview, ShopeeSources } from "./types.ts"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function review(value: unknown): ShopeeReview | null {
  const raw = asRecord(value)
  if (!raw || typeof raw.id !== "string" || !raw.id) return null
  const origin = asRecord(raw.source)
  const manual = origin?.kind === "manual"
  const stars = raw.stars == null || raw.stars === "" ? null : Number(raw.stars)
  if (manual) {
    if (stars != null && !(stars >= 1 && stars <= 5)) return null
  } else if (!(stars === 4 || stars === 5)) return null
  if (typeof raw.text !== "string") return null
  const media = Array.isArray(raw.media)
    ? raw.media.flatMap((item) => {
        const row = asRecord(item)
        if (!row || (row.type !== "image" && row.type !== "video") || typeof row.url !== "string") return []
        return [{ type: row.type, url: row.url }]
      })
    : []
  return {
    id: raw.id,
    stars,
    text: raw.text,
    date: typeof raw.date === "string" ? raw.date : "",
    media,
    ...(typeof raw.variation === "string" && raw.variation ? { variation: raw.variation } : {}),
    ...(typeof raw.phrase === "string" && raw.phrase ? { phrase: raw.phrase } : {}),
    ...(manual && typeof origin?.pastedAt === "string"
      ? { source: { kind: "manual" as const, pastedAt: origin.pastedAt } }
      : {}),
  }
}

export function parseStoredShopee(value: unknown): ShopeeProduct | undefined {
  const raw = asRecord(value)
  if (!raw || typeof raw.itemId !== "string" || typeof raw.shopId !== "string") return undefined
  const badges = asRecord(raw.badges) ?? {}
  const variations = Array.isArray(raw.variations)
    ? raw.variations.flatMap((item) => {
        const row = asRecord(item)
        if (!row || typeof row.name !== "string" || !Array.isArray(row.options)) return []
        const options = row.options.filter((option): option is string => typeof option === "string")
        return [{ name: row.name, options }]
      })
    : []
  return {
    itemId: raw.itemId,
    shopId: raw.shopId,
    url: typeof raw.url === "string" ? raw.url : "",
    fetchedAt: typeof raw.fetchedAt === "string" ? raw.fetchedAt : "",
    title: typeof raw.title === "string" ? raw.title : "",
    shortName: typeof raw.shortName === "string" ? raw.shortName : "",
    category: Array.isArray(raw.category) ? raw.category.filter((item): item is string => typeof item === "string") : [],
    rating: typeof raw.rating === "number" ? raw.rating : null,
    ratingCount: typeof raw.ratingCount === "number" ? raw.ratingCount : null,
    sold: typeof raw.sold === "number" ? raw.sold : null,
    variations,
    badges: {
      ...(badges.freeShipping === true ? { freeShipping: true } : {}),
      ...(badges.mall === true ? { mall: true } : {}),
      ...(badges.officialStore === true ? { officialStore: true } : {}),
      ...(badges.preferred === true ? { preferred: true } : {}),
    },
    images: Array.isArray(raw.images) ? raw.images.filter((item): item is string => typeof item === "string") : [],
    reviews: Array.isArray(raw.reviews) ? raw.reviews.flatMap((item) => {
      const parsed = review(item)
      return parsed ? [parsed] : []
    }) : [],
    ...(parseSources(raw.sources) ? { sources: parseSources(raw.sources) } : {}),
  }
}

function parseSources(value: unknown): ShopeeSources | undefined {
  const raw = asRecord(value)
  if (!raw) return undefined
  const feed = raw.feed === "ok" || raw.feed === "miss" || raw.feed === "error" ? raw.feed : null
  const openapi = raw.openapi === "ok" || raw.openapi === "not_configured" || raw.openapi === "error" ? raw.openapi : null
  const reviews = raw.reviews === "ok" || raw.reviews === "error" ? raw.reviews : null
  if (!feed || !openapi || !reviews) return undefined
  return {
    feed,
    openapi,
    reviews,
    ...(typeof raw.feedError === "string" ? { feedError: raw.feedError } : {}),
    ...(typeof raw.openapiError === "string" ? { openapiError: raw.openapiError } : {}),
    ...(typeof raw.reviewsError === "string" ? { reviewsError: raw.reviewsError } : {}),
  }
}
