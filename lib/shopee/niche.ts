import type { BrandKitId } from "../brand/kits.ts"
import type { ContentNiche } from "../content/presets.ts"

export function nicheFromCategories(category: string[]): { niche: ContentNiche; kit: BrandKitId } {
  const text = category.join(" ").toLowerCase()
  if (/beb[eê]|infantil|fralda|maternidade|enxoval/.test(text)) return { niche: "bebe", kit: "bebe" }
  if (/beleza|maquiagem|skincare|cabelo|perfume|cosmet/.test(text)) return { niche: "beleza", kit: "beleza" }
  if (/moda|roupa|vestu|cal[cç]a|short|tric[oô]|vestido|sapato/.test(text)) return { niche: "moda", kit: "moda" }
  return { niche: "shopee", kit: "shopee" }
}
