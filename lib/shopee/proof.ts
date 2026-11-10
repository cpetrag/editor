import { formatRating, formatSoldLabel } from "./format.ts"
import type { ProofCard, ShopeeProduct, ShopeeReview, ShopeeVariation } from "./types.ts"

function variationNamed(variations: ShopeeVariation[], pattern: RegExp): ShopeeVariation | undefined {
  return variations.find((item) => pattern.test(item.name))
}

export function sizeLine(options: string[]): string | null {
  const values = options.map((item) => item.trim()).filter(Boolean)
  if (values.length < 2) return null
  return `Do ${values[0]} ao ${values[values.length - 1]}`
}

export function colorLine(count: number): string | null {
  if (!(count > 0)) return null
  return count === 1 ? "1 cor" : `${count} cores`
}

export function quoteText(review: ShopeeReview): string {
  const phrase = (review.phrase || review.text).replace(/\s+/g, " ").trim()
  const stars = review.stars
  if (stars == null || !(stars >= 1 && stars <= 5)) return `“${phrase}”\ncliente Shopee`
  return `“${phrase}”\ncliente Shopee ${"⭐".repeat(stars)}`
}

export function ratingText(rating: number, sold: number): string {
  return `⭐ ${formatRating(rating)} · ${formatSoldLabel(sold)}`
}

export function buildProofInserts(product: Pick<ShopeeProduct, "rating" | "sold" | "variations" | "badges" | "reviews" | "fetchedAt">): ProofCard[] {
  const cards: ProofCard[] = []
  if (product.rating != null && product.sold != null) {
    const text = ratingText(product.rating, product.sold)
    cards.push({
      id: "rating",
      field: "rating",
      text,
      styleId: "selo",
      y: 36,
      snapshot: text,
    })
  } else if (product.sold != null) {
    const text = `${formatSoldLabel(product.sold)}`
    cards.push({
      id: "sold",
      field: "sold",
      text,
      styleId: "selo",
      y: 36,
      snapshot: text,
    })
  } else if (product.rating != null) {
    const text = `⭐ ${formatRating(product.rating)}`
    cards.push({
      id: "rating",
      field: "rating",
      text,
      styleId: "selo",
      y: 36,
      snapshot: text,
    })
  }
  const quote = product.reviews.find((review) => (review.phrase || review.text).trim())
  if (quote) {
    const text = quoteText(quote)
    cards.push({
      id: `quote-${quote.id}`,
      field: "quote",
      text,
      styleId: "balao",
      y: 58,
      reviewId: quote.id,
      snapshot: text,
      ...(quote.source?.kind === "manual" ? { pasted: true } : {}),
    })
  }
  const sizes = variationNamed(product.variations, /tamanho|size|numera/i)
  const sizesText = sizes ? sizeLine(sizes.options) : null
  if (sizesText) {
    cards.push({
      id: "sizes",
      field: "sizes",
      text: sizesText,
      styleId: "etiqueta",
      y: 48,
      snapshot: sizesText,
    })
  }
  const colors = variationNamed(product.variations, /^cor$|color/i)
  const colorsText = colors ? colorLine(colors.options.length) : null
  if (colorsText) {
    cards.push({
      id: "colors",
      field: "colors",
      text: colorsText,
      styleId: "etiqueta",
      y: 66,
      snapshot: colorsText,
    })
  }
  const badges: string[] = []
  if (product.badges.freeShipping) badges.push("Frete grátis")
  if (product.badges.mall) badges.push("Shopee Mall")
  if (product.badges.officialStore) badges.push("Loja oficial")
  for (const badge of badges) {
    cards.push({
      id: `badge-${badge}`,
      field: "badge",
      text: badge,
      styleId: "selo",
      y: 28,
      snapshot: badge,
    })
  }
  return cards
}
