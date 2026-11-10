import type { Composition } from "../composition.ts"
import type { ProductData } from "../content/runs.ts"
import type { ExportWarning } from "../export-checklist.ts"
import { formatRating, formatSold } from "./format.ts"
import { cleanCategoryTrail, nicheForCategory } from "./category-niche.ts"
import { sizeLine } from "./proof.ts"
import type { ShopeeProduct } from "./types.ts"

const STALE_MS = 7 * 24 * 60 * 60 * 1000

export function productFieldsFromShopee(product: ShopeeProduct): ProductData {
  const sizes = product.variations.find((item) => /tamanho|size|numera/i.test(item.name))
  const colors = product.variations.find((item) => /^cor$|color/i.test(item.name))
  const sizeText = sizes ? sizeLine(sizes.options) : null
  const data: ProductData = {}
  if (product.shortName.trim()) data.produto = product.shortName.trim()
  else if (product.title.trim()) data.produto = product.title.trim()
  if (product.rating != null) data.nota = formatRating(product.rating)
  if (product.sold != null) data.vendidos = formatSold(product.sold).replace(/^\+/, "")
  if (sizeText) data.tamanhos = sizeText.replace(/^Do\s+/i, "")
  if (colors && colors.options.length > 0) data.qtd = String(colors.options.length)
  return data
}

export function applyImportedProduct(composition: Composition, product: ShopeeProduct): Composition {
  const fields = productFieldsFromShopee(product)
  const category = cleanCategoryTrail(product.category)
  const stored = category.length === product.category.length ? product : { ...product, category }
  const suggestion = nicheForCategory(category)
  return {
    ...composition,
    pricing: composition.pricing === "on" ? "on" : "off",
    productData: { ...composition.productData, ...fields },
    shopee: {
      ...stored,
      reviews: [
        ...stored.reviews.filter((review) => review.source?.kind !== "manual"),
        ...(composition.shopee?.reviews ?? []).filter((review) => review.source?.kind === "manual"),
      ],
    },
    ...(suggestion && !composition.nicheManual ? { niche: suggestion.niche } : {}),
    ...(suggestion && !composition.kitManual ? { brandKitId: suggestion.kit } : {}),
  }
}

export function shopeeStaleWarning(product: ShopeeProduct | undefined, now = Date.now()): ExportWarning | null {
  if (!product?.fetchedAt) return null
  const at = Date.parse(product.fetchedAt)
  if (!Number.isFinite(at) || now - at < STALE_MS) return null
  const day = new Date(at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return {
    id: "shopee-stale",
    code: "shopee-stale",
    insertIds: [],
    title: `Nota e vendidos importados em ${day} — atualize antes de anunciar`,
  }
}
