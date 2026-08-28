import { DEFAULT_CHIP_SCALE, SCALE_MAX, SCALE_MIN, type CompositionInsert } from "../composition.ts"
import { parseCssColor } from "../compose/insert-style.ts"
import { getElementPreset } from "./catalog.ts"
import { wrapsElementShape } from "./copy.ts"

export const ELEMENT_MAX_WIDTH_PCT_MIN = 28
export const ELEMENT_MAX_WIDTH_PCT_MAX = 90
export const DEFAULT_ELEMENT_MAX_WIDTH_PCT = 72

function clampScale(value: number): number {
  return Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, value)) * 1000) / 1000
}

function clampMaxWidthPct(value: number): number {
  return Math.round(Math.min(ELEMENT_MAX_WIDTH_PCT_MAX, Math.max(ELEMENT_MAX_WIDTH_PCT_MIN, value)))
}

export function elementTextOf(insert: CompositionInsert): string {
  const typed = insert.text?.trim()
  if (typed) return typed
  return getElementPreset(insert.type)?.defaultText ?? ""
}

export function elementColorsOf(insert: CompositionInsert): { primary: string; secondary: string } {
  const preset = getElementPreset(insert.type)
  return {
    primary: parseCssColor(insert.fillColor) ?? preset?.primary ?? "#111111",
    secondary: parseCssColor(insert.accentColor) ?? preset?.secondary ?? "#FFFFFF",
  }
}

export function elementScaleOf(insert: CompositionInsert): number {
  const preset = getElementPreset(insert.type)
  const scale = insert.scale ?? preset?.defaultScale ?? DEFAULT_CHIP_SCALE
  return clampScale(scale)
}

export function applyElementText(insert: CompositionInsert, text: string): Partial<CompositionInsert> {
  return { text }
}

export function applyElementColors(
  insert: CompositionInsert,
  patch: { primary?: string; secondary?: string },
): Partial<CompositionInsert> {
  const current = elementColorsOf(insert)
  const primary = parseCssColor(patch.primary) ?? current.primary
  const secondary = parseCssColor(patch.secondary) ?? current.secondary
  return { fillColor: primary, accentColor: secondary }
}

export function applyElementScale(insert: CompositionInsert, scale: number): Partial<CompositionInsert> {
  return { scale: clampScale(scale) }
}

export function nudgeElementScale(insert: CompositionInsert, delta: number): Partial<CompositionInsert> {
  return applyElementScale(insert, elementScaleOf(insert) + delta)
}

export function wrapsElementText(insert: CompositionInsert): boolean {
  const shape = getElementPreset(insert.type)?.shape
  return Boolean(shape && wrapsElementShape(shape))
}

export function elementMaxWidthPctOf(insert: CompositionInsert): number {
  if (!wrapsElementText(insert)) return DEFAULT_ELEMENT_MAX_WIDTH_PCT
  return clampMaxWidthPct(insert.maxWidthPct ?? DEFAULT_ELEMENT_MAX_WIDTH_PCT)
}

export function nudgeElementMaxWidth(insert: CompositionInsert, delta: number): Partial<CompositionInsert> {
  return { maxWidthPct: clampMaxWidthPct(elementMaxWidthPctOf(insert) + delta) }
}
