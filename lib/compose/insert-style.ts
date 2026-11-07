export const FONT_IDS = [
  "geist",
  "poppins",
  "bebas",
  "archivo",
  "playfair",
  "space",
  "oswald",
  "montserrat",
  "anton",
  "inter",
  "alfa",
  "nunito",
  "lilita",
  "luckiest",
  "baloo",
  "titan",
  "caveat",
  "courier",
  "archivo-black",
  "permanent-marker",
  "pacifico",
  "fredoka",
] as const

export type FontId = (typeof FONT_IDS)[number]
export type FontWeight = 400 | 500 | 600 | 700 | 800 | 900
export type ShadowPreset = "none" | "soft" | "hard" | "glow"

export type InsertStyle = {
  fontFamily: FontId
  fontWeight: FontWeight
  uppercase: boolean
  color: string
  bgColor: string | null
  strokeWidth: number
  strokeColor: string
  shadow: ShadowPreset
  opacity: number
  rotation: number
}

export const FONT_WEIGHTS: readonly FontWeight[] = [400, 500, 600, 700, 800, 900]

export const WEIGHTS_BY_FONT: Record<FontId, readonly FontWeight[]> = {
  geist: [400, 500, 600, 700, 800, 900],
  poppins: [400, 500, 600, 700, 800, 900],
  bebas: [400],
  archivo: [400],
  playfair: [400, 500, 600, 700, 800, 900],
  space: [400, 500, 600, 700],
  oswald: [400, 500, 600, 700],
  montserrat: [400, 500, 600, 700, 800, 900],
  anton: [400],
  inter: [400, 500, 600, 700, 800, 900],
  alfa: [400],
  nunito: [400, 500, 600, 700, 800, 900],
  lilita: [400],
  luckiest: [400],
  baloo: [400, 500, 600, 700, 800],
  titan: [400],
  caveat: [700],
  courier: [700],
  "archivo-black": [400],
  "permanent-marker": [400],
  pacifico: [400],
  fredoka: [700],
}

export function clampFontWeight(fontId: FontId, weight: FontWeight): FontWeight {
  const allowed = WEIGHTS_BY_FONT[fontId]
  if (allowed.includes(weight)) return weight
  let best: FontWeight | undefined
  for (const next of allowed) {
    if (next <= weight) best = next
  }
  return best ?? allowed[0] ?? 400
}

export const SHADOW_PRESETS: Array<{ id: ShadowPreset; label: string }> = [
  { id: "none", label: "Nenhuma" },
  { id: "soft", label: "Suave" },
  { id: "hard", label: "Dura" },
  { id: "glow", label: "Glow" },
]

export const SHOPEE_COLOR_SWATCHES = [
  { id: "orange", hex: "#EE4D2D", label: "Laranja" },
  { id: "red", hex: "#EE2C2C", label: "Vermelho" },
  { id: "yellow", hex: "#FFD427", label: "Amarelo" },
  { id: "white", hex: "#FFFFFF", label: "Branco" },
  { id: "black", hex: "#000000", label: "Preto" },
] as const

const FONT_ALIASES: Record<string, FontId> = {
  geist: "geist",
  poppins: "poppins",
  bebas: "bebas",
  "bebas-neue": "bebas",
  "bebas neue": "bebas",
  archivo: "archivo",
  "archivo-black": "archivo-black",
  "archivo black": "archivo-black",
  playfair: "playfair",
  "playfair-display": "playfair",
  "playfair display": "playfair",
  space: "space",
  "space-grotesk": "space",
  "space grotesk": "space",
  oswald: "oswald",
  montserrat: "montserrat",
  anton: "anton",
  inter: "inter",
  alfa: "alfa",
  "alfa-slab": "alfa",
  "alfa-slab-one": "alfa",
  "alfa slab one": "alfa",
  nunito: "nunito",
  lilita: "lilita",
  "lilita-one": "lilita",
  "lilita one": "lilita",
  luckiest: "luckiest",
  "luckiest-guy": "luckiest",
  "luckiest guy": "luckiest",
  baloo: "baloo",
  "baloo-2": "baloo",
  baloo2: "baloo",
  titan: "titan",
  "titan-one": "titan",
  "titan one": "titan",
  caveat: "caveat",
  courier: "courier",
  "courier-prime": "courier",
  "courier prime": "courier",
  "permanent-marker": "permanent-marker",
  "permanent marker": "permanent-marker",
  pacifico: "pacifico",
  fredoka: "fredoka",
}

const STYLE_KEYS = [
  "fontFamily",
  "fontWeight",
  "uppercase",
  "color",
  "bgColor",
  "strokeWidth",
  "strokeColor",
  "shadow",
  "opacity",
  "rotation",
] as const

const CHIP_DEFAULT: InsertStyle = {
  fontFamily: "geist",
  fontWeight: 600,
  uppercase: false,
  color: "#ffffff",
  bgColor: "rgba(0,0,0,0.6)",
  strokeWidth: 0,
  strokeColor: "#000000",
  shadow: "none",
  opacity: 1,
  rotation: 0,
}

const TEXT_DEFAULT: InsertStyle = {
  fontFamily: "geist",
  fontWeight: 800,
  uppercase: false,
  color: "#ffffff",
  bgColor: null,
  strokeWidth: 6,
  strokeColor: "#000000",
  shadow: "none",
  opacity: 1,
  rotation: 0,
}

export const DEFAULT_STYLE_BY_TYPE: Record<string, InsertStyle> = {
  "logo-shopee": CHIP_DEFAULT,
  "selo-frete": CHIP_DEFAULT,
  "alerta-desconto": CHIP_DEFAULT,
  "preco-riscado": CHIP_DEFAULT,
  cupom: CHIP_DEFAULT,
  contador: CHIP_DEFAULT,
  "barra-estoque": CHIP_DEFAULT,
  estrelas: CHIP_DEFAULT,
  seta: CHIP_DEFAULT,
  "tarja-frete": CHIP_DEFAULT,
  "seta-mao": CHIP_DEFAULT,
  "circulo-destaque": CHIP_DEFAULT,
  "bubble-comentario": CHIP_DEFAULT,
  "divisor-antes-depois": CHIP_DEFAULT,
  passo: CHIP_DEFAULT,
  "tarja-espera": CHIP_DEFAULT,
  "texto-livre": TEXT_DEFAULT,
  legenda: TEXT_DEFAULT,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function expandHex(value: string): string {
  const hex = value.slice(1)
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase()
  }
  return value.toUpperCase()
}

export function parseFontId(value: unknown): FontId | undefined {
  if (typeof value !== "string") return undefined
  return FONT_ALIASES[value.trim().toLowerCase()]
}

export function resolveFontId(value: string, fallback: FontId = "inter"): FontId {
  const parsed = parseFontId(value)
  if (parsed) return parsed
  const slug = value.trim().toLowerCase().replace(/\s+/g, "-")
  const fromSlug = parseFontId(slug)
  if (fromSlug) return fromSlug
  console.warn(`[editor] fonte desconhecida "${value}", usando ${fallback}`)
  return fallback
}

function parseHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return undefined
  if (trimmed.length === 4) return expandHex(trimmed)
  return trimmed.toUpperCase()
}

export function parseCssColor(value: unknown): string | undefined {
  const hex = parseHexColor(value)
  if (hex) return hex
  if (typeof value === "string" && /^(?:rgba?|hsla?)\(/i.test(value.trim())) {
    return value.trim()
  }
  return undefined
}

function parseFontWeight(value: unknown): FontWeight | undefined {
  const parsed = asNumber(value)
  if (parsed === null) return undefined
  let best: FontWeight = 400
  let dist = Number.POSITIVE_INFINITY
  for (const weight of FONT_WEIGHTS) {
    const next = Math.abs(weight - parsed)
    if (next < dist || (next === dist && weight < best)) {
      dist = next
      best = weight
    }
  }
  return best
}

function parseShadow(value: unknown): ShadowPreset | undefined {
  if (value === "none" || value === "soft" || value === "hard" || value === "glow") {
    return value
  }
  return undefined
}

function hasStyleKey(raw: Record<string, unknown>): boolean {
  return STYLE_KEYS.some((key) => key in raw)
}

export function parseInsertStyle(raw: unknown): InsertStyle | undefined {
  if (!isRecord(raw) || !hasStyleKey(raw)) return undefined

  const parsed: Partial<InsertStyle> = {}
  if ("fontFamily" in raw) {
    const fontFamily = parseFontId(raw.fontFamily)
    if (fontFamily) parsed.fontFamily = fontFamily
  }
  if ("fontWeight" in raw) {
    const fontWeight = parseFontWeight(raw.fontWeight)
    if (fontWeight) parsed.fontWeight = fontWeight
  }
  if ("uppercase" in raw && typeof raw.uppercase === "boolean") {
    parsed.uppercase = raw.uppercase
  }
  if ("color" in raw) {
    const color = parseCssColor(raw.color)
    if (color) parsed.color = color
  }
  if ("bgColor" in raw) {
    if (raw.bgColor === null || raw.bgColor === "" || raw.bgColor === "transparent") {
      parsed.bgColor = null
    } else {
      parsed.bgColor = parseCssColor(raw.bgColor) ?? null
    }
  }
  if ("strokeWidth" in raw) {
    const strokeWidth = asNumber(raw.strokeWidth)
    if (strokeWidth !== null) parsed.strokeWidth = Math.round(clamp(strokeWidth, 0, 12))
  }
  if ("strokeColor" in raw) {
    const strokeColor = parseCssColor(raw.strokeColor)
    if (strokeColor) parsed.strokeColor = strokeColor
  }
  if ("shadow" in raw) {
    parsed.shadow = parseShadow(raw.shadow) ?? "none"
  }
  if ("opacity" in raw) {
    const opacity = asNumber(raw.opacity)
    if (opacity !== null) parsed.opacity = clamp(opacity, 0, 1)
  }
  if ("rotation" in raw) {
    const rotation = asNumber(raw.rotation)
    if (rotation !== null) parsed.rotation = rotation
  }

  if (Object.keys(parsed).length === 0) return undefined

  const typeDefault =
    typeof raw.type === "string" && DEFAULT_STYLE_BY_TYPE[raw.type]
      ? DEFAULT_STYLE_BY_TYPE[raw.type]
      : CHIP_DEFAULT

  return { ...typeDefault, ...parsed }
}

export function resolveInsertStyle(
  insert: { type: string; style?: InsertStyle },
  brandFontId = "geist",
): InsertStyle {
  const typeDefault = DEFAULT_STYLE_BY_TYPE[insert.type] ?? CHIP_DEFAULT
  const merged: InsertStyle = insert.style
    ? { ...typeDefault, ...insert.style }
    : {
        ...typeDefault,
        fontFamily: parseFontId(brandFontId) ?? typeDefault.fontFamily,
      }
  const fontFamily = parseFontId(merged.fontFamily) ?? merged.fontFamily
  return {
    ...merged,
    fontFamily,
    fontWeight: clampFontWeight(fontFamily, merged.fontWeight),
  }
}

export function patchInsertStyle(
  insert: { type: string; style?: InsertStyle },
  patch: Partial<InsertStyle>,
  brandFontId = "geist",
): InsertStyle {
  const typeDefault = DEFAULT_STYLE_BY_TYPE[insert.type] ?? CHIP_DEFAULT
  const base: InsertStyle = insert.style
    ? { ...typeDefault, ...insert.style }
    : {
        ...typeDefault,
        fontFamily: parseFontId(brandFontId) ?? typeDefault.fontFamily,
      }
  const merged: InsertStyle = { ...base, ...patch }
  const fontFamily = parseFontId(merged.fontFamily) ?? merged.fontFamily
  const fontWeight =
    patch.fontFamily !== undefined
      ? clampFontWeight(fontFamily, merged.fontWeight)
      : merged.fontWeight
  return { ...merged, fontFamily, fontWeight }
}

export interface CanvasShadow {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

export function canvasShadow(shadow: ShadowPreset, textColor: string): CanvasShadow | null {
  if (shadow === "none") return null
  if (shadow === "soft") {
    return { color: "rgba(0,0,0,0.55)", blur: 14, offsetX: 0, offsetY: 6 }
  }
  if (shadow === "hard") {
    return { color: "#000000", blur: 0, offsetX: 4, offsetY: 4 }
  }
  return { color: textColor, blur: 18, offsetX: 0, offsetY: 0 }
}

export function applyCanvasShadow(
  ctx: Pick<
    CanvasRenderingContext2D,
    "shadowColor" | "shadowBlur" | "shadowOffsetX" | "shadowOffsetY"
  >,
  shadow: ShadowPreset,
  textColor: string,
): void {
  const next = canvasShadow(shadow, textColor)
  if (!next) {
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    return
  }
  ctx.shadowColor = next.color
  ctx.shadowBlur = next.blur
  ctx.shadowOffsetX = next.offsetX
  ctx.shadowOffsetY = next.offsetY
}
