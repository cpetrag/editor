import { isEmptyOverrides } from "./deep-merge.ts"
import { LEGADO_PRESET_ID } from "./presets.ts"
import type { DeepPartial, InsertStyle, StyleRef, TextStyle } from "./types.ts"

export type LegacyShadow = "nenhuma" | "suave" | "dura" | "glow" | "none" | "soft" | "hard"

export type LegacyFlatStyle = {
  fontFamily?: string
  fontWeight?: number
  shadow?: string
  opacity?: number
  rotation?: number
  color?: string
  uppercase?: boolean
  bgColor?: string | null
  strokeWidth?: number
  strokeColor?: string
}

export type LegacyInsert = {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  shadow?: string
  opacity?: number
  rotation?: number
  x?: number
  y?: number
  style?: LegacyFlatStyle
}

export type ShadowLayer = { x: number; y: number; blur: number; color: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function mapLegacyShadow(
  shadow: string | undefined,
  textColor = "#FFFFFF",
): ShadowLayer[] {
  if (!shadow || shadow === "nenhuma" || shadow === "none") return []
  if (shadow === "suave" || shadow === "soft") {
    return [{ x: 0, y: 6, blur: 14, color: "rgba(0,0,0,0.55)" }]
  }
  if (shadow === "dura" || shadow === "hard") {
    return [{ x: 4, y: 4, blur: 0, color: "#000000" }]
  }
  if (shadow === "glow") {
    return [{ x: 0, y: 0, blur: 18, color: textColor }]
  }
  return []
}

function opacityToPercent(value: number): number {
  if (value <= 1) return Math.round(value * 100)
  return value
}

export function migrateInsertStyle(legacy: LegacyInsert): StyleRef {
  const nested = legacy.style ?? {}
  const fontFamily = nested.fontFamily ?? legacy.fontFamily
  const fontWeight = nested.fontWeight ?? legacy.fontWeight
  const rotation = nested.rotation ?? legacy.rotation
  const opacity = nested.opacity ?? legacy.opacity
  const shadow = nested.shadow ?? legacy.shadow
  const color = nested.color
  const text: DeepPartial<TextStyle> = {}

  if (fontFamily !== undefined) text.fontFamily = fontFamily
  if (legacy.fontSize !== undefined) text.fontSize = legacy.fontSize
  if (fontWeight !== undefined) text.fontWeight = fontWeight
  if (shadow !== undefined) text.shadows = mapLegacyShadow(shadow, color ?? "#FFFFFF")
  if (opacity !== undefined) text.opacity = opacityToPercent(opacity)
  if (rotation !== undefined) text.rotation = rotation
  if (legacy.x !== undefined) text.x = legacy.x
  if (legacy.y !== undefined) text.y = legacy.y
  if (color !== undefined) text.color = color
  if (nested.uppercase === true) text.textTransform = "uppercase"
  if (nested.uppercase === false) text.textTransform = "none"

  if (nested.bgColor !== undefined) {
    if (nested.bgColor === null || nested.bgColor === "" || nested.bgColor === "transparent") {
      text.background = { enabled: false }
    } else {
      text.background = { enabled: true, color: nested.bgColor, opacity: 100 }
    }
  }

  if (nested.strokeWidth !== undefined || nested.strokeColor !== undefined) {
    const width = nested.strokeWidth ?? 0
    text.stroke = {
      enabled: width > 0,
      ...(nested.strokeWidth !== undefined ? { width: nested.strokeWidth } : {}),
      ...(nested.strokeColor !== undefined ? { color: nested.strokeColor } : {}),
    }
  }

  const overrides: DeepPartial<InsertStyle> = isEmptyOverrides(text) ? {} : { text }
  return { presetId: LEGADO_PRESET_ID, overrides }
}

export function parseStyleRef(raw: unknown): StyleRef | undefined {
  if (!isRecord(raw)) return undefined
  if (typeof raw.presetId !== "string" || !raw.presetId.trim()) return undefined
  const overrides = isRecord(raw.overrides) ? (raw.overrides as DeepPartial<InsertStyle>) : {}
  return { presetId: raw.presetId, overrides }
}

export function styleRefFromLegacy(legacy: LegacyInsert): StyleRef | undefined {
  const migrated = migrateInsertStyle(legacy)
  if (isEmptyOverrides(migrated.overrides)) return undefined
  return migrated
}
