export type ShopeeMedia = {
  type: "image" | "video"
  url: string
}

export type ManualReviewSource = {
  kind: "manual"
  pastedAt: string
}

export type ShopeeReview = {
  id: string
  /** Vazio quando a avaliação foi colada sem nota. Não presumir 5. */
  stars: number | null
  text: string
  date: string
  variation?: string
  media: ShopeeMedia[]
  phrase?: string
  source?: ManualReviewSource
}

export type ShopeeVariation = {
  name: string
  options: string[]
}

export type ShopeeBadges = {
  freeShipping?: boolean
  mall?: boolean
  officialStore?: boolean
  preferred?: boolean
}

export type ShopeeSources = {
  feed: "ok" | "miss" | "error"
  openapi: "ok" | "not_configured" | "error"
  reviews: "ok" | "error"
  feedError?: string
  openapiError?: string
  reviewsError?: string
}

export type ShopeeProduct = {
  itemId: string
  shopId: string
  url: string
  fetchedAt: string
  title: string
  shortName: string
  category: string[]
  rating: number | null
  ratingCount: number | null
  sold: number | null
  variations: ShopeeVariation[]
  badges: ShopeeBadges
  images: string[]
  reviews: ShopeeReview[]
  sources?: ShopeeSources
}

export type ShopeeSourceField = "rating" | "sold" | "quote" | "sizes" | "colors" | "badge" | "reviewMedia"

export type ShopeeInsertSource = {
  kind: "shopee"
  field?: ShopeeSourceField
  reviewId?: string
  fetchedAt: string
  snapshot?: string
  /** Etiqueta do editor. Não entra no texto do vídeo. */
  pasted?: boolean
}

export type ProofCard = {
  id: string
  field: ShopeeSourceField
  text: string
  styleId: string
  y: number
  reviewId?: string
  snapshot: string
  pasted?: boolean
}
