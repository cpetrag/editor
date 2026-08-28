import type { CompositionInsert } from "../composition.ts"
import {
  clampFontWeight,
  FONT_WEIGHTS,
  resolveFontId,
  type FontWeight,
  type InsertStyle as ComposeInsertStyle,
} from "../compose/insert-style.ts"
import { getTextPreset, isTextPresetId } from "../text-presets/catalog.ts"
import { textPresetToInsertStyle } from "../text-presets/to-insert-style.ts"
import { deepMerge, isEmptyOverrides } from "./deep-merge.ts"
import { styleRefFromLegacy } from "./migrate.ts"
import { getPresetStyle, LEGADO_PRESET_ID } from "./presets.ts"
import type { InsertStyle, StyleLayer } from "./types.ts"

export type ResolveInsertStyleContext = {
  project?: StyleLayer
  track?: StyleLayer | null
  frameWidth?: number
}

function isTextInsert(insert: CompositionInsert): boolean {
  return insert.kind === "text" || insert.type === "texto-livre"
}

function snapFontWeight(value: number): FontWeight {
  let best: FontWeight = 400
  let dist = Number.POSITIVE_INFINITY
  for (const weight of FONT_WEIGHTS) {
    const next = Math.abs(weight - value)
    if (next < dist || (next === dist && weight < best)) {
      dist = next
      best = weight
    }
  }
  return best
}

function overlayLegadoLayout(style: InsertStyle, insert: CompositionInsert): InsertStyle {
  return {
    ...style,
    text: {
      ...style.text,
      ...(typeof insert.fontSize === "number" ? { fontSize: insert.fontSize } : {}),
      ...(typeof insert.x === "number" ? { x: insert.x } : {}),
      ...(typeof insert.y === "number" ? { y: insert.y } : {}),
      ...(typeof insert.rotation === "number" ? { rotation: insert.rotation } : {}),
    },
  }
}

function normalizeResolvedStyle(style: InsertStyle): InsertStyle {
  const fontFamily = resolveFontId(String(style.text.fontFamily ?? "inter"))
  const rawWeight = typeof style.text.fontWeight === "number" ? style.text.fontWeight : 400
  const fontWeight = clampFontWeight(fontFamily, snapFontWeight(rawWeight))
  return {
    ...style,
    text: {
      ...style.text,
      fontFamily,
      fontWeight,
    },
  }
}

export function resolveInsertStyle(
  insert: CompositionInsert,
  ctx: ResolveInsertStyleContext = {},
): InsertStyle {
  const frameWidth = ctx.frameWidth ?? 1080
  const project = ctx.project ?? {}
  const track = ctx.track ?? null
  const ref = insert.styleRef ?? track?.styleRef ?? project.styleRef
  const factory = Boolean(ref && ref.presetId !== LEGADO_PRESET_ID)

  const base = isTextPresetId(insert.preset)
    ? textPresetToInsertStyle(getTextPreset(insert.preset), frameWidth, {
        x: insert.x ?? 50,
        y: insert.y ?? 35,
        fontSize: insert.fontSize,
        rotation: insert.rotation,
      })
    : getPresetStyle(ref?.presetId)

  const merged = deepMerge(
    base,
    project.styleRef?.overrides,
    track?.styleRef?.overrides,
    insert.styleRef?.overrides,
  )
  const normalized = normalizeResolvedStyle(merged)
  if (isTextPresetId(insert.preset) || factory) return normalized
  return overlayLegadoLayout(normalized, insert)
}

export function toComposeInsertStyle(resolved: InsertStyle): ComposeInsertStyle {
  const fontFamily = resolveFontId(String(resolved.text.fontFamily ?? "inter"))
  const rawWeight = typeof resolved.text.fontWeight === "number" ? resolved.text.fontWeight : 400
  const fontWeight = clampFontWeight(fontFamily, snapFontWeight(rawWeight))
  return {
    fontFamily,
    fontWeight,
    uppercase: resolved.text.textTransform === "uppercase",
    color: resolved.text.color,
    bgColor: resolved.text.background.enabled ? resolved.text.background.color : null,
    strokeWidth: resolved.text.stroke.enabled ? Math.round(resolved.text.stroke.width) : 0,
    strokeColor: resolved.text.stroke.color,
    shadow: resolved.text.shadows.length > 0 ? "hard" : "none",
    opacity: Math.max(0, Math.min(1, resolved.text.opacity / 100)),
    rotation: resolved.text.rotation,
  }
}

export function withSyncedComposeStyle(
  insert: CompositionInsert,
  ctx: ResolveInsertStyleContext = {},
): CompositionInsert {
  if (!isTextInsert(insert)) return insert
  return {
    ...insert,
    style: toComposeInsertStyle(resolveInsertStyle(insert, ctx)),
  }
}

export function reconcileInsertStyle(insert: CompositionInsert): CompositionInsert {
  if (!isTextInsert(insert)) return insert
  const overrides = insert.styleRef?.overrides
  if (!isEmptyOverrides(overrides)) {
    return withSyncedComposeStyle(insert)
  }
  if (!insert.style) return insert
  const migrated = styleRefFromLegacy({
    fontFamily: insert.fontFamily,
    fontSize: insert.fontSize,
    rotation: insert.rotation,
    x: insert.x,
    y: insert.y,
    style: insert.style,
  })
  if (!migrated) return withSyncedComposeStyle(insert)
  return withSyncedComposeStyle({
    ...insert,
    styleRef: {
      presetId: insert.styleRef?.presetId ?? LEGADO_PRESET_ID,
      overrides: migrated.overrides,
    },
  })
}
