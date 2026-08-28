export const TEXT_PRESET_SCHEMA = "textPreset@1" as const

export const TEXT_PRESET_GROUPS = ["impacto", "destaque", "apoio"] as const
export type TextPresetGroup = (typeof TEXT_PRESET_GROUPS)[number]

export const TEXT_PRESET_ANIM_KINDS = [
  "none",
  "fade",
  "fade-up",
  "pop",
  "slide-up",
  "wipe-left",
  "stamp",
  "typewriter",
  "scale-x",
] as const
export type TextPresetAnimKind = (typeof TEXT_PRESET_ANIM_KINDS)[number]

export const TEXT_PRESET_BOX_MODES = ["none", "pill", "block", "highlight-line"] as const
export type TextPresetBoxMode = (typeof TEXT_PRESET_BOX_MODES)[number]

export type TextPresetAnim = {
  kind: TextPresetAnimKind
  durationMs: number
  easing?: string
  charStaggerMs?: number
}

export type TextPresetBox = {
  mode: TextPresetBoxMode
  color: string
  opacity: number
  radiusRatio: number
  padXRatio: number
  padYRatio: number
}

export type TextPresetShadow = {
  xRatio: number
  yRatio: number
  blurRatio: number
  color: string
}

export type TextPreset = {
  schema: typeof TEXT_PRESET_SCHEMA
  id: string
  name: string
  group: TextPresetGroup
  font: { family: string; weight: number; italic?: boolean }
  size: { ratio: number; minRatio: number }
  transform: "none" | "uppercase"
  tracking: number
  lineHeight: number
  align: "left" | "center" | "right"
  maxWidthPct: number
  color: string
  stroke?: { color: string; widthRatio: number }
  shadows?: TextPresetShadow[]
  box?: TextPresetBox
  rotate?: number
  animIn: TextPresetAnim
  animOut: TextPresetAnim
}

const COLOR_RE =
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_RE = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+\s*)?\)$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && (COLOR_RE.test(value.trim()) || RGB_RE.test(value.trim()))
}

function fail(path: string, detail: string): never {
  throw new Error(`preset de texto inválido em ${path}: ${detail}`)
}

function readString(raw: Record<string, unknown>, key: string, path: string): string {
  const value = raw[key]
  if (typeof value !== "string" || !value.trim()) fail(`${path}.${key}`, "string não vazia obrigatória")
  return value
}

function readNumber(raw: Record<string, unknown>, key: string, path: string, min?: number, max?: number): number {
  const value = raw[key]
  if (!isFiniteNumber(value)) fail(`${path}.${key}`, "número finito obrigatório")
  if (min !== undefined && value < min) fail(`${path}.${key}`, `deve ser >= ${min}`)
  if (max !== undefined && value > max) fail(`${path}.${key}`, `deve ser <= ${max}`)
  return value
}

function readAnim(raw: unknown, path: string): TextPresetAnim {
  if (!isRecord(raw)) fail(path, "objeto obrigatório")
  const kind = raw.kind
  if (typeof kind !== "string" || !TEXT_PRESET_ANIM_KINDS.includes(kind as TextPresetAnimKind)) {
    fail(`${path}.kind`, `kind inválido: ${String(kind)}`)
  }
  const anim: TextPresetAnim = {
    kind: kind as TextPresetAnimKind,
    durationMs: readNumber(raw, "durationMs", path, 0),
  }
  if (raw.easing !== undefined) {
    if (typeof raw.easing !== "string" || !raw.easing.trim()) fail(`${path}.easing`, "string inválida")
    anim.easing = raw.easing
  }
  if (raw.charStaggerMs !== undefined) {
    anim.charStaggerMs = readNumber(raw, "charStaggerMs", path, 0)
  }
  return anim
}

function itemPath(path: string, index: number): string {
  return path + "[" + String(index) + "]"
}

function readShadows(raw: unknown, path: string): TextPresetShadow[] {
  if (!Array.isArray(raw)) fail(path, "array obrigatório")
  return raw.map((item, index) => {
    const at = itemPath(path, index)
    if (!isRecord(item)) fail(at, "objeto obrigatório")
    if (!isColor(item.color)) fail(at + ".color", "cor hex/rgba inválida")
    return {
      xRatio: readNumber(item, "xRatio", at),
      yRatio: readNumber(item, "yRatio", at),
      blurRatio: readNumber(item, "blurRatio", at, 0),
      color: item.color,
    }
  })
}

function readBox(raw: unknown, path: string): TextPresetBox {
  if (!isRecord(raw)) fail(path, "objeto obrigatório")
  const mode = raw.mode
  if (typeof mode !== "string" || !TEXT_PRESET_BOX_MODES.includes(mode as TextPresetBoxMode)) {
    fail(`${path}.mode`, `mode inválido: ${String(mode)}`)
  }
  if (!isColor(raw.color)) fail(`${path}.color`, "cor hex/rgba inválida")
  return {
    mode: mode as TextPresetBoxMode,
    color: raw.color,
    opacity: readNumber(raw, "opacity", path, 0, 1),
    radiusRatio: readNumber(raw, "radiusRatio", path, 0),
    padXRatio: readNumber(raw, "padXRatio", path, 0),
    padYRatio: readNumber(raw, "padYRatio", path, 0),
  }
}

export function isTextPreset(value: unknown): value is TextPreset {
  try {
    assertTextPreset(value)
    return true
  } catch {
    return false
  }
}

export function assertTextPreset(value: unknown): TextPreset {
  if (!isRecord(value)) fail("$", "objeto obrigatório")
  if (value.schema !== TEXT_PRESET_SCHEMA) fail("schema", `esperado ${TEXT_PRESET_SCHEMA}`)
  const id = readString(value, "id", "$")
  const name = readString(value, "name", "$")
  const group = value.group
  if (typeof group !== "string" || !TEXT_PRESET_GROUPS.includes(group as TextPresetGroup)) {
    fail("group", `group inválido: ${String(group)}`)
  }
  if (!isRecord(value.font)) fail("font", "objeto obrigatório")
  const family = readString(value.font, "family", "font")
  const weight = readNumber(value.font, "weight", "font", 100, 900)
  if (!isRecord(value.size)) fail("size", "objeto obrigatório")
  const ratio = readNumber(value.size, "ratio", "size", 0)
  const minRatio = readNumber(value.size, "minRatio", "size", 0)
  if (minRatio > ratio) fail("size.minRatio", "não pode ser maior que size.ratio")
  const transform = value.transform
  if (transform !== "none" && transform !== "uppercase") fail("transform", "none | uppercase")
  const align = value.align
  if (align !== "left" && align !== "center" && align !== "right") fail("align", "left | center | right")
  if (!isColor(value.color)) fail("color", "cor hex/rgba inválida")

  const preset: TextPreset = {
    schema: TEXT_PRESET_SCHEMA,
    id,
    name,
    group: group as TextPresetGroup,
    font: {
      family,
      weight,
      ...(value.font.italic === true ? { italic: true } : {}),
    },
    size: { ratio, minRatio },
    transform,
    tracking: readNumber(value, "tracking", "$"),
    lineHeight: readNumber(value, "lineHeight", "$", 0.5),
    align,
    maxWidthPct: readNumber(value, "maxWidthPct", "$", 0, 1),
    color: value.color,
    animIn: readAnim(value.animIn, "animIn"),
    animOut: readAnim(value.animOut, "animOut"),
  }

  if (value.stroke !== undefined) {
    if (!isRecord(value.stroke)) fail("stroke", "objeto obrigatório")
    if (!isColor(value.stroke.color)) fail("stroke.color", "cor hex/rgba inválida")
    preset.stroke = {
      color: value.stroke.color,
      widthRatio: readNumber(value.stroke, "widthRatio", "stroke", 0),
    }
  }
  if (value.shadows !== undefined) preset.shadows = readShadows(value.shadows, "shadows")
  if (value.box !== undefined) preset.box = readBox(value.box, "box")
  if (value.rotate !== undefined) preset.rotate = readNumber(value, "rotate", "$")
  return preset
}
