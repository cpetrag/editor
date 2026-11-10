export const BRAND_KITS = [
  { id: "shopee", label: "Shopee", primary: "#EE4D2D", onPrimary: "#FFFFFF", accent: "#FFD400", ink: "#111111", paper: "#FFFFFF" },
  { id: "beleza", label: "Beauty rosé", primary: "#E0569B", onPrimary: "#FFFFFF", accent: "#FFD1E6", ink: "#2A0F1D", paper: "#FFF4F8" },
  { id: "bebe", label: "Baby pastel", primary: "#5DB7EA", onPrimary: "#FFFFFF", accent: "#FFC4D6", ink: "#2F3A63", paper: "#FFFBEA" },
  { id: "moda", label: "Moda nude", primary: "#1A1A1A", onPrimary: "#F4ECE2", accent: "#C79A6B", ink: "#111111", paper: "#F4ECE2" },
  { id: "contraste", label: "Alto contraste", primary: "#FFE600", onPrimary: "#000000", accent: "#FF2D55", ink: "#000000", paper: "#FFFFFF" },
] as const

export type BrandKitId = (typeof BRAND_KITS)[number]["id"]
export type BrandKit = (typeof BRAND_KITS)[number]
export type ColorSlot = "primary" | "onPrimary" | "accent" | "ink" | "paper"

const SLOT_PREFIX = "slot:"

export function isBrandKitId(value: string): value is BrandKitId {
  return BRAND_KITS.some((kit) => kit.id === value)
}

export function brandKitOf(id: string | undefined): BrandKit {
  return BRAND_KITS.find((kit) => kit.id === id) ?? BRAND_KITS[0]
}

/** Hex e cores CSS ficam como estão. `slot:primary` segue o kit. */
export function resolveColor(color: string, kit: BrandKit): string {
  if (!color.startsWith(SLOT_PREFIX)) return color
  const slot = color.slice(SLOT_PREFIX.length) as ColorSlot
  return kit[slot] ?? color
}
