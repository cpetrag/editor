import { affiliateConfigured, readOfferProduct } from "./affiliate.ts"
import { assembleShopeeProduct, resolveProductIds } from "./assemble.ts"
import { readShopeeCache, writeShopeeCache } from "./cache.ts"
import { phraseFromReview, shortenTitle } from "./copy.ts"
import { readFeedProduct } from "./feed.ts"
import { readReviewBundle } from "./reviews-client.ts"
import { openApiSource } from "./sources.ts"
import { isShopeeHost } from "./url.ts"
import type { ShopeeProduct, ShopeeSources } from "./types.ts"

async function followRedirect(raw: string): Promise<string> {
  const start = new URL(raw)
  if (start.protocol !== "https:" && start.protocol !== "http:") {
    throw new Error("Esse link não é um produto da Shopee.")
  }
  if (!isShopeeHost(start.hostname)) throw new Error("Esse link não é um produto da Shopee.")
  const response = await fetch(start.href, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
  const finalUrl = response.url || start.href
  const landed = new URL(finalUrl)
  if (!isShopeeHost(landed.hostname)) throw new Error("Esse link não é um produto da Shopee.")
  return finalUrl
}

export async function loadShopeeProduct(url: string, refresh = false): Promise<ShopeeProduct> {
  const ids = await resolveProductIds(url, followRedirect)
  if (!refresh) {
    const cached = readShopeeCache(ids.itemId)
    if (cached?.sources) return cached
  }
  const [feed, offer, reviews] = await Promise.all([
    readFeedProduct(ids.itemId),
    affiliateConfigured() ? readOfferProduct(ids.itemId) : Promise.resolve(null),
    readReviewBundle(ids.shopId, ids.itemId),
  ])
  const sources: ShopeeSources = {
    feed: feed.status,
    ...(feed.status === "error" ? { feedError: feed.error } : {}),
    ...openApiSource({ configured: affiliateConfigured(), error: offer && "error" in offer ? offer.error : null }),
    reviews: reviews.bundle ? "ok" : "error",
    ...(!reviews.bundle ? { reviewsError: reviews.error || "avaliações indisponíveis" } : {}),
  }
  const product = await assembleShopeeProduct({
    ids,
    feed: feed.status === "ok" ? feed.data : null,
    offer: offer && "data" in offer ? offer.data : null,
    reviews: reviews.bundle,
    fetchedAt: new Date().toISOString(),
    shorten: shortenTitle,
    phrase: phraseFromReview,
  })
  const withSources: ShopeeProduct = { ...product, sources }
  writeShopeeCache(withSources)
  return withSources
}
