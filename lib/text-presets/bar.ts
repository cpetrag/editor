import type { CompositionInsert } from "../composition.ts"
import { patchStyleRef, SHADOW_SHORTCUTS } from "../style/edit-style.ts"
import type { StyleRef } from "../style/types.ts"
import { DEFAULT_TEXT_PRESET_ID, getTextPreset, isTextPresetId } from "./catalog.ts"
import { boxModeOfInsert } from "./fill.ts"

const DEFAULT_BG_COLOR = "#111111"
const DEFAULT_BG_MODE = "bloco" as const
const DEFAULT_BG_OPACITY = 88
const DEFAULT_RADIUS = 16
const RADIUS_MIN = 0
const RADIUS_MAX = 80

function backgroundOverride(insert: CompositionInsert) {
  return insert.styleRef?.overrides?.text?.background
}

function presetHasShadows(insert: CompositionInsert): boolean {
  const presetId = isTextPresetId(insert.preset) ? insert.preset : DEFAULT_TEXT_PRESET_ID
  return (getTextPreset(presetId).shadows?.length ?? 0) > 0
}

export function textBackgroundEnabledOf(insert: CompositionInsert): boolean {
  const enabled = backgroundOverride(insert)?.enabled
  if (typeof enabled === "boolean") return enabled
  if (insert.style?.bgColor) return true
  return boxModeOfInsert(insert) !== "none"
}

export function textShadowEnabledOf(insert: CompositionInsert): boolean {
  const shadows = insert.styleRef?.overrides?.text?.shadows
  if (shadows) return shadows.length > 0
  return presetHasShadows(insert)
}

export function textRadiusOf(insert: CompositionInsert): number {
  const radius = backgroundOverride(insert)?.radius
  if (typeof radius === "number" && Number.isFinite(radius)) return radius
  return DEFAULT_RADIUS
}

export function applyTextBackground(
  insert: CompositionInsert,
  enabled: boolean,
): Partial<CompositionInsert> {
  let ref: StyleRef = patchStyleRef(insert.styleRef, "text.background.enabled", enabled)
  if (enabled) {
    const current = backgroundOverride(insert)
    if (!current?.color) {
      ref = patchStyleRef(ref, "text.background.color", DEFAULT_BG_COLOR)
    }
    if (!current?.mode) {
      ref = patchStyleRef(ref, "text.background.mode", DEFAULT_BG_MODE)
    }
    if (current?.opacity == null) {
      ref = patchStyleRef(ref, "text.background.opacity", DEFAULT_BG_OPACITY)
    }
    if (current?.radius == null) {
      ref = patchStyleRef(ref, "text.background.radius", DEFAULT_RADIUS)
    }
  }
  const color =
    (ref.overrides?.text?.background?.color as string | undefined) ?? DEFAULT_BG_COLOR
  return {
    styleRef: ref,
    style: { ...insert.style, bgColor: enabled ? color : null },
  }
}

export function applyTextShadow(
  insert: CompositionInsert,
  enabled: boolean,
): Partial<CompositionInsert> {
  return {
    styleRef: patchStyleRef(
      insert.styleRef,
      "text.shadows",
      enabled ? SHADOW_SHORTCUTS.soft : [],
    ),
  }
}

export function nudgeTextRadius(
  insert: CompositionInsert,
  delta: number,
): Partial<CompositionInsert> {
  if (!textBackgroundEnabledOf(insert)) return {}
  const next = Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, textRadiusOf(insert) + delta))
  return {
    styleRef: patchStyleRef(insert.styleRef, "text.background.radius", next),
  }
}
