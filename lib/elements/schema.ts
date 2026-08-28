export const ELEMENT_PRESET_SCHEMA = "elementPreset@1" as const

export const ELEMENT_SHAPES = [
  "logo",
  "badge",
  "price",
  "ticket",
  "countdown",
  "stock",
  "stars",
  "arrow",
  "banner",
  "hand-arrow",
  "circle",
  "bubble",
  "divider",
  "steps",
] as const

export type ElementShape = (typeof ELEMENT_SHAPES)[number]

export const ELEMENT_FONT_IDS = ["anton", "inter", "poppins", "archivo", "caveat", "courier"] as const
export type ElementFontId = (typeof ELEMENT_FONT_IDS)[number]

export type ElementPreset = {
  schema: typeof ELEMENT_PRESET_SCHEMA
  id: string
  name: string
  shape: ElementShape
  defaultText: string
  hasText: boolean
  primary: string
  secondary: string
  fontFamily: ElementFontId
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900
  uppercase: boolean
  radiusRatio: number
  padXRatio: number
  padYRatio: number
  heightRatio: number
  minWidthRatio: number
  shadow: "none" | "hard" | "soft"
  defaultX: number
  defaultY: number
  defaultScale: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function fail(path: string, detail: string): never {
  throw new Error(`elemento inválido em ${path}: ${detail}`)
}

function readString(raw: Record<string, unknown>, key: string, path: string): string {
  const value = raw[key]
  if (typeof value !== "string" || !value.trim()) fail(`${path}.${key}`, "string não vazia obrigatória")
  return value.trim()
}

function readHex(raw: Record<string, unknown>, key: string, path: string): string {
  const value = readString(raw, key, path)
  if (!HEX_RE.test(value)) fail(`${path}.${key}`, "hex #rgb ou #rrggbb")
  return value.toUpperCase()
}

function readUnit(raw: Record<string, unknown>, key: string, path: string): number {
  const value = raw[key]
  if (!isFiniteNumber(value) || value < 0 || value > 1) fail(`${path}.${key}`, "deve estar em 0..1")
  return value
}

function readPct(raw: Record<string, unknown>, key: string, path: string): number {
  const value = raw[key]
  if (!isFiniteNumber(value) || value < 0 || value > 100) fail(`${path}.${key}`, "deve estar em 0..100")
  return value
}

function readPositive(raw: Record<string, unknown>, key: string, path: string): number {
  const value = raw[key]
  if (!isFiniteNumber(value) || value <= 0) fail(`${path}.${key}`, "deve ser > 0")
  return value
}

export function isElementPreset(raw: unknown): raw is ElementPreset {
  try {
    assertElementPreset(raw)
    return true
  } catch {
    return false
  }
}

export function assertElementPreset(raw: unknown): ElementPreset {
  if (!isRecord(raw)) fail("", "objeto obrigatório")
  if (raw.schema !== ELEMENT_PRESET_SCHEMA) fail("schema", `esperado ${ELEMENT_PRESET_SCHEMA}`)
  const id = readString(raw, "id", "")
  const name = readString(raw, "name", "")
  const shape = raw.shape
  if (typeof shape !== "string" || !ELEMENT_SHAPES.includes(shape as ElementShape)) {
    fail("shape", `forma inválida: ${String(shape)}`)
  }
  const fontFamily = raw.fontFamily
  if (typeof fontFamily !== "string" || !ELEMENT_FONT_IDS.includes(fontFamily as ElementFontId)) {
    fail("fontFamily", `fonte fora dos tokens: ${String(fontFamily)}`)
  }
  const fontWeight = raw.fontWeight
  if (fontWeight !== 400 && fontWeight !== 500 && fontWeight !== 600 && fontWeight !== 700 && fontWeight !== 800 && fontWeight !== 900) {
    fail("fontWeight", "peso inválido")
  }
  if (typeof raw.hasText !== "boolean") fail("hasText", "boolean obrigatório")
  if (typeof raw.uppercase !== "boolean") fail("uppercase", "boolean obrigatório")
  const shadow = raw.shadow
  if (shadow !== "none" && shadow !== "hard" && shadow !== "soft") fail("shadow", "none | hard | soft")
  return {
    schema: ELEMENT_PRESET_SCHEMA,
    id,
    name,
    shape: shape as ElementShape,
    defaultText: typeof raw.defaultText === "string" ? raw.defaultText : "",
    hasText: raw.hasText,
    primary: readHex(raw, "primary", ""),
    secondary: readHex(raw, "secondary", ""),
    fontFamily: fontFamily as ElementFontId,
    fontWeight,
    uppercase: raw.uppercase,
    radiusRatio: readUnit(raw, "radiusRatio", ""),
    padXRatio: readUnit(raw, "padXRatio", ""),
    padYRatio: readUnit(raw, "padYRatio", ""),
    heightRatio: readPositive(raw, "heightRatio", ""),
    minWidthRatio: readUnit(raw, "minWidthRatio", ""),
    shadow,
    defaultX: readPct(raw, "defaultX", ""),
    defaultY: readPct(raw, "defaultY", ""),
    defaultScale: readPositive(raw, "defaultScale", ""),
  }
}
