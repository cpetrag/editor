import { clipPhrase } from "./format.ts"
import { pickReviews } from "./reviews.ts"
import type { ShopeeProduct, ShopeeReview } from "./types.ts"

const PHONE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/g

function isPhoneLine(line: string): boolean {
  return /^(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}$/.test(line.trim())
}

function looksLikeName(line: string): boolean {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 2 || parts.length > 3) return false
  return parts.every((part) => /^[\p{Lu}][\p{L}'-]{1,}$/u.test(part))
}

/** Tira @, telefone e uma assinatura de nome no começo ou no fim do bloco. */
export function stripBuyerMarks(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const body = lines.map((line) => line.trim()).filter((line) => line && !isPhoneLine(line))
  while (body.length > 1 && looksLikeName(body[0] ?? "")) body.shift()
  while (body.length > 1 && looksLikeName(body[body.length - 1] ?? "")) body.pop()
  return stripInlineSignature(
    body
      .join(" ")
      .replace(/@[\p{L}\p{N}._]+/gu, "")
      .replace(PHONE, "")
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  )
}

/** "Maria S. -", "Ana:", "— João" e "Maria Silva –" no começo ou no fim. */
function stripInlineSignature(text: string): string {
  const lead = /^(?:[—–-]\s*)?[\p{Lu}][\p{L}]*(?:\s+[\p{Lu}][\p{L}.]*){0,2}\s*[:—–-]\s+/u
  const leadDash = /^[—–-]\s*[\p{Lu}][\p{L}.]*(?:\s+[\p{Lu}][\p{L}.]*){0,2}\s+/u
  const tail = /\s+[—–-]\s*[\p{Lu}][\p{L}.]*(?:\s+[\p{Lu}][\p{L}.]*){0,2}\s*$/u
  const tailMark = /\s+[\p{Lu}][\p{L}.]*(?:\s+[\p{Lu}][\p{L}.]*){0,2}\s*[:—–-]\s*$/u
  let next = text
  for (let pass = 0; pass < 2; pass += 1) {
    const stripped = next.replace(lead, "").replace(leadDash, "").replace(tail, "").replace(tailMark, "").trim()
    if (!stripped || stripped === next) break
    next = stripped
  }
  return next
}

export function splitPastedBlocks(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function starsOf(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  if (value >= 1 && value <= 5) return value
  return null
}

/** Blocos separados por linha em branco viram avaliações manuais, com a mesma frase curta. */
export function parsePastedReviews(
  raw: string,
  input?: { pastedAt?: string; stars?: Array<number | null | undefined> },
): ShopeeReview[] {
  const pastedAt = input?.pastedAt ?? new Date().toISOString()
  const drafts = splitPastedBlocks(raw).map((block, index) => ({
    id: `manual-${index + 1}-${pastedAt}`,
    stars: starsOf(input?.stars?.[index]),
    text: stripBuyerMarks(block),
    date: pastedAt,
    media: [],
    source: { kind: "manual" as const, pastedAt },
  }))
  return pickReviews(drafts).map((review) => ({
    ...review,
    phrase: clipPhrase(review.text),
    source: { kind: "manual" as const, pastedAt },
  }))
}

export function emptyShopeeShell(pastedAt = new Date().toISOString()): ShopeeProduct {
  return {
    itemId: "manual",
    shopId: "manual",
    url: "",
    fetchedAt: pastedAt,
    title: "",
    shortName: "",
    category: [],
    rating: null,
    ratingCount: null,
    sold: null,
    variations: [],
    badges: {},
    images: [],
    reviews: [],
  }
}

export function withPastedReviews(product: ShopeeProduct | undefined, reviews: ShopeeReview[]): ShopeeProduct {
  const base = product ?? emptyShopeeShell(reviews[0]?.source?.pastedAt)
  const imported = base.reviews.filter((review) => review.source?.kind !== "manual")
  const pasted = reviews.filter((review) => review.source?.kind === "manual")
  return { ...base, reviews: [...imported, ...pasted] }
}
