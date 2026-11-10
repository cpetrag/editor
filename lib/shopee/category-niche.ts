import type { BrandKitId } from "../brand/kits.ts"
import type { ContentNiche } from "../content/presets.ts"

/** Id de 1º nível do feed Shopee (`global_catid1` → `global_category1`). */
export type CategoryNiche = {
  id: string
  name: string
  niche: ContentNiche
  kit: BrandKitId
}

const MODA = { niche: "moda" as const, kit: "moda" as const }
const BELEZA = { niche: "beleza" as const, kit: "beleza" as const }
const BEBE = { niche: "bebe" as const, kit: "bebe" as const }
const GERAL = { niche: "shopee" as const, kit: "shopee" as const }

export const CATEGORY_NICHES: readonly CategoryNiche[] = [
  { id: "100017", name: "Women Clothes", ...MODA },
  { id: "100011", name: "Men Clothes", ...MODA },
  { id: "100532", name: "Women Shoes", ...MODA },
  { id: "100012", name: "Men Shoes", ...MODA },
  { id: "100016", name: "Women Bags", ...MODA },
  { id: "100533", name: "Men Bags", ...MODA },
  { id: "100009", name: "Fashion Accessories", ...MODA },
  { id: "100534", name: "Watches", ...MODA },
  { id: "100630", name: "Beauty", ...BELEZA },
  { id: "100632", name: "Mom & Baby", ...BEBE },
  { id: "100633", name: "Baby & Kids Fashion", ...BEBE },
  { id: "102187", name: "Spare Parts and Accessories for Vehicles", ...GERAL },
  { id: "100636", name: "Home & Living", ...GERAL },
  { id: "100643", name: "Books & Magazines", ...GERAL },
  { id: "100637", name: "Sports & Outdoors", ...GERAL },
  { id: "100629", name: "Food & Beverages", ...GERAL },
  { id: "100010", name: "Home Appliances", ...GERAL },
  { id: "100638", name: "Stationery", ...GERAL },
  { id: "100001", name: "Health", ...GERAL },
  { id: "100639", name: "Hobbies & Collections", ...GERAL },
  { id: "100644", name: "Computers & Accessories", ...GERAL },
  { id: "100631", name: "Pets", ...GERAL },
  { id: "100013", name: "Mobile & Gadgets", ...GERAL },
  { id: "100535", name: "Audio", ...GERAL },
  { id: "100634", name: "Gaming & Consoles", ...GERAL },
  { id: "100635", name: "Cameras & Drones", ...GERAL },
  { id: "100015", name: "Travel & Luggage", ...GERAL },
  { id: "100640", name: "Automobiles", ...GERAL },
  { id: "100641", name: "Motorcycles", ...GERAL },
]

const BY_ID = new Map(CATEGORY_NICHES.map((row) => [row.id, row]))
const BY_NAME = new Map(CATEGORY_NICHES.map((row) => [row.name.toLowerCase(), row]))

export function cleanCategoryTrail(category: string[]): string[] {
  return category.map((item) => item.trim()).filter((item) => item !== "" && item !== "0")
}

/** Nicho do id (ou do nome) de 1º nível. Id fora da tabela devolve null. */
export function nicheForCategory(category: string[]): CategoryNiche | null {
  const [first] = cleanCategoryTrail(category)
  if (!first) return null
  return BY_ID.get(first) ?? BY_NAME.get(first.toLowerCase()) ?? null
}

/** Id numérico de 1º nível que a tabela não conhece. */
export function unknownCategoryId(category: string[]): string | null {
  const [first] = cleanCategoryTrail(category)
  if (!first || !/^\d+$/.test(first)) return null
  if (BY_ID.has(first)) return null
  return first
}
