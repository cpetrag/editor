export const BRAND_KITS = [
  { id: "shopee", label: "Shopee", primary: "#EE4D2D", onPrimary: "#FFFFFF", accent: "#FFD400", ink: "#111111", paper: "#FFFFFF" },
  { id: "beleza", label: "Beauty rosé", primary: "#E0569B", onPrimary: "#FFFFFF", accent: "#FFD1E6", ink: "#2A0F1D", paper: "#FFF4F8" },
  { id: "bebe", label: "Baby pastel", primary: "#5DB7EA", onPrimary: "#FFFFFF", accent: "#FFC4D6", ink: "#2F3A63", paper: "#FFFBEA" },
  { id: "moda", label: "Moda nude", primary: "#1A1A1A", onPrimary: "#F4ECE2", accent: "#C79A6B", ink: "#111111", paper: "#F4ECE2" },
  { id: "contraste", label: "Alto contraste", primary: "#FFE600", onPrimary: "#000000", accent: "#FF2D55", ink: "#000000", paper: "#FFFFFF" },
] as const

export type BrandKitId = (typeof BRAND_KITS)[number]["id"]
export type BrandKit = (typeof BRAND_KITS)[number]
export const COLOR_SLOTS = ["primary", "onPrimary", "accent", "ink", "paper"] as const
export type ColorSlot = (typeof COLOR_SLOTS)[number]
export type BrandColors = Record<ColorSlot, string>

export const COLOR_SLOT_LABEL: Record<ColorSlot, string> = {
  primary: "Principal",
  onPrimary: "Texto sobre principal",
  accent: "Destaque",
  ink: "Texto escuro",
  paper: "Fundo claro",
}

/** Paleta da biblioteca do usuário. O projeto não depende dela: guarda `brandColors`. */
export type CustomBrandKit = BrandColors & {
  id: string
  label: string
  baseKitId: BrandKitId
}

const SLOT_PREFIX = "slot:"
const CUSTOM_KIT_ID = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isBrandKitId(value: string): value is BrandKitId {
  return BRAND_KITS.some((kit) => kit.id === value)
}

export function isCustomBrandKitId(value: string): boolean {
  return CUSTOM_KIT_ID.test(value)
}

export function isColorSlot(value: string): value is ColorSlot {
  return (COLOR_SLOTS as readonly string[]).includes(value)
}

export function brandKitOf(id: string | undefined): BrandKit {
  return BRAND_KITS.find((kit) => kit.id === id) ?? BRAND_KITS[0]
}

export function colorsOf(kit: BrandColors): BrandColors {
  return {
    primary: kit.primary,
    onPrimary: kit.onPrimary,
    accent: kit.accent,
    ink: kit.ink,
    paper: kit.paper,
  }
}

export function parseHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null
  const hex = value.trim().toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(hex)) return hex
  if (/^#[0-9A-F]{3}$/.test(hex)) {
    const [red, green, blue] = hex.slice(1)
    return `#${red}${red}${green}${green}${blue}${blue}`
  }
  return null
}

export function parseBrandColors(raw: unknown): BrandColors | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const record = raw as Record<string, unknown>
  const colors = {} as BrandColors
  for (const slot of COLOR_SLOTS) {
    const hex = parseHexColor(record[slot])
    if (!hex) return undefined
    colors[slot] = hex
  }
  return colors
}

export function parsePaletteOverride(raw: unknown): Partial<BrandColors> | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const record = raw as Record<string, unknown>
  const colors: Partial<BrandColors> = {}
  for (const slot of COLOR_SLOTS) {
    const hex = parseHexColor(record[slot])
    if (hex) colors[slot] = hex
  }
  return Object.keys(colors).length > 0 ? colors : undefined
}

export function parseCustomBrandKit(raw: unknown): CustomBrandKit | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  if (typeof record.id !== "string" || !isCustomBrandKitId(record.id)) return null
  if (typeof record.label !== "string" || !record.label.trim()) return null
  if (typeof record.baseKitId !== "string" || !isBrandKitId(record.baseKitId)) return null
  const colors = parseBrandColors(record)
  if (!colors) return null
  return { id: record.id, label: record.label.trim().slice(0, 40), baseKitId: record.baseKitId, ...colors }
}

/** Procura nas paletas fixas e nas personalizadas. Sem match, cai na primeira fixa. */
export function resolveBrandKit(id: string | undefined, customKits: readonly CustomBrandKit[] = []): BrandKit | CustomBrandKit {
  const custom = customKits.find((kit) => kit.id === id)
  if (custom) return custom
  return brandKitOf(id)
}

export function originKitId(id: string | undefined, customKits: readonly CustomBrandKit[] = []): BrandKitId {
  const custom = customKits.find((kit) => kit.id === id)
  if (custom) return custom.baseKitId
  if (id && isBrandKitId(id)) return id
  return BRAND_KITS[0].id
}

export function projectBrandColors(
  brandKitId: string | undefined,
  brandColors: BrandColors | undefined,
  customKits: readonly CustomBrandKit[] = [],
): BrandColors {
  return mergeBrandColors(colorsOf(resolveBrandKit(brandKitId, customKits)), brandColors)
}

export function mergeBrandColors(base: BrandColors, extra?: Partial<BrandColors> | null): BrandColors {
  const next = colorsOf(base)
  if (!extra) return next
  for (const slot of COLOR_SLOTS) {
    const hex = parseHexColor(extra[slot])
    if (hex) next[slot] = hex
  }
  return next
}

/**
 * Cores que o preview e o export pintam.
 * `brandColors` é o snapshot do projeto e vence a paleta da biblioteca.
 * `paletteOverride` vale só para aquele insert.
 */
export function paintBrandKit(input: {
  brandKitId?: string
  brandColors?: Partial<BrandColors> | null
  customKits?: readonly CustomBrandKit[]
  paletteOverride?: Partial<BrandColors> | null
}): BrandColors & { id: string; label: string } {
  const named = resolveBrandKit(input.brandKitId, input.customKits ?? [])
  const colors = mergeBrandColors(colorsOf(named), input.brandColors)
  return { id: named.id, label: named.label, ...mergeBrandColors(colors, input.paletteOverride) }
}

/** Hex e cores CSS ficam como estão. `slot:primary` segue o kit. */
export function resolveColor(color: string, kit: BrandColors): string {
  if (!color.startsWith(SLOT_PREFIX)) return color
  const slot = color.slice(SLOT_PREFIX.length)
  if (!isColorSlot(slot)) return color
  return kit[slot] ?? color
}
