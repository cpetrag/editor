import { acceptExtractedPhrase, fallbackShortName } from "./format.ts"
import { pickReviews } from "./reviews.ts"
import type { FeedFacts } from "./feed.ts"
import type { ReviewBundle } from "./reviews-client.ts"
import { canonicalShopeeUrl, isOpaqueShopeeShort, parseShopeeUrlStrict, type ShopeeIds } from "./url.ts"
import type { ShopeeBadges, ShopeeProduct, ShopeeReview, ShopeeVariation } from "./types.ts"

const EMPTY_BADGES: ShopeeBadges = {}

function variationsFromReviews(reviews: ShopeeReview[]): ShopeeVariation[] {
  const sizes: string[] = []
  const colors: string[] = []
  const push = (list: string[], value: string) => {
    const clean = value.trim()
    if (clean && !list.includes(clean)) list.push(clean)
  }
  for (const review of reviews) {
    const text = review.variation || ""
    const size = text.match(/tamanho\s*:\s*([^,]+)/i)
    const color = text.match(/cor\s*:\s*([^,]+)/i)
    if (size?.[1]) push(sizes, size[1])
    if (color?.[1]) push(colors, color[1])
  }
  const variations: ShopeeVariation[] = []
  if (sizes.length > 0) variations.push({ name: "Tamanho", options: sizes })
  if (colors.length > 0) variations.push({ name: "Cor", options: colors })
  return variations
}

function mergeBadges(current: ShopeeBadges, next: ShopeeBadges | undefined): ShopeeBadges {
  if (!next) return current
  return {
    ...(current.freeShipping || next.freeShipping ? { freeShipping: true } : {}),
    ...(current.mall || next.mall ? { mall: true } : {}),
    ...(current.officialStore || next.officialStore ? { officialStore: true } : {}),
    ...(current.preferred || next.preferred ? { preferred: true } : {}),
  }
}

export async function resolveProductIds(raw: string, follow: (url: string) => Promise<string>): Promise<ShopeeIds> {
  if (!isOpaqueShopeeShort(raw)) return parseShopeeUrlStrict(raw)
  const resolved = await follow(raw)
  return parseShopeeUrlStrict(resolved)
}

export async function assembleShopeeProduct(input: {
  ids: ShopeeIds
  feed: FeedFacts | null
  offer: FeedFacts | null
  reviews: ReviewBundle | null
  fetchedAt: string
  shorten: (title: string) => Promise<string>
  phrase: (text: string) => Promise<string>
}): Promise<ShopeeProduct> {
  const feed = input.feed
  const offer = input.offer
  const reviewFacts = input.reviews?.facts
  const title = feed?.title || offer?.title || reviewFacts?.title || ""
  const category = feed?.category?.length ? feed.category : offer?.category ?? []
  const rating = feed?.rating ?? offer?.rating ?? reviewFacts?.rating ?? null
  const ratingCount = feed?.ratingCount ?? offer?.ratingCount ?? null
  const sold = feed?.sold ?? offer?.sold ?? reviewFacts?.sold ?? null
  const images = feed?.images?.length ? feed.images : offer?.images?.length ? offer.images : reviewFacts?.images ?? []
  const reviews = pickReviews(input.reviews?.reviews ?? []).slice(0, 30)
  const variations = feed?.variations?.length ? feed.variations : offer?.variations?.length ? offer.variations : variationsFromReviews(reviews)
  const badges = mergeBadges(mergeBadges(EMPTY_BADGES, feed?.badges), offer?.badges)
  const shortName = title ? await input.shorten(title) : ""
  const withPhrases: ShopeeReview[] = []
  const batchSize = 4
  for (let index = 0; index < reviews.length; index += batchSize) {
    const batch = reviews.slice(index, index + batchSize)
    const phrases = await Promise.all(batch.map((review) => input.phrase(review.text)))
    batch.forEach((review, phraseIndex) => {
      const phrase = phrases[phraseIndex] || ""
      withPhrases.push({ ...review, phrase: acceptExtractedPhrase(review.text, phrase) })
    })
  }
  return {
    itemId: input.ids.itemId,
    shopId: feed?.shopId || offer?.shopId || input.ids.shopId,
    url: canonicalShopeeUrl(input.ids),
    fetchedAt: input.fetchedAt,
    title,
    shortName: shortName.trim() || fallbackShortName(title),
    category,
    rating,
    ratingCount,
    sold,
    variations,
    badges,
    images,
    reviews: withPhrases,
  }
}
