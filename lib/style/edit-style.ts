import { omitTransformOverrides } from "../insert-transform.ts"
import { deleteAtPath, isEmptyOverrides, setAtPath } from "./deep-merge.ts"
import { LEGADO_PRESET_ID } from "./presets.ts"
import type { DeepPartial, InsertStyle, StyleLayer, StyleRef } from "./types.ts"
import type { ShadowLayer } from "./migrate.ts"

export type FieldOrigin = "preset" | "projeto" | "faixa" | "insert"

export const ORIGIN_LABEL: Record<FieldOrigin, string> = {
  preset: "Preset",
  projeto: "Projeto",
  faixa: "Faixa",
  insert: "Insert",
}

export type ShadowShortcutId = "none" | "soft" | "hard" | "glow"

export const SHADOW_SHORTCUTS: Record<ShadowShortcutId, ShadowLayer[]> = {
  none: [],
  soft: [{ x: 0, y: 6, blur: 14, color: "rgba(0,0,0,0.55)" }],
  hard: [{ x: 6, y: 6, blur: 0, color: "#000000" }],
  glow: [{ x: 0, y: 0, blur: 18, color: "#FFFFFF" }],
}

export function ensureStyleRef(
  current: StyleRef | undefined,
  presetId = LEGADO_PRESET_ID,
): StyleRef {
  return {
    presetId: current?.presetId || presetId,
    overrides: current?.overrides ?? {},
  }
}

export function workingStyleRef(
  insert: StyleLayer,
  track: StyleLayer | null,
  project: StyleLayer,
): StyleRef {
  if (insert.styleRef) return insert.styleRef
  const nearest = track?.styleRef ?? project.styleRef
  return { presetId: nearest?.presetId || LEGADO_PRESET_ID, overrides: {} }
}

export function patchStyleRef(
  current: StyleRef | undefined,
  path: string,
  value: unknown,
): StyleRef {
  const base = ensureStyleRef(current)
  return {
    ...base,
    overrides: setAtPath(base.overrides, path, value),
  }
}

export function resetStyleField(current: StyleRef, path: string): StyleRef {
  const overrides = deleteAtPath(current.overrides ?? {}, path)
  return {
    presetId: current.presetId,
    overrides: isEmptyOverrides(overrides) ? {} : (overrides as StyleRef["overrides"]),
  }
}

export function resetStyleOverrides(current: StyleRef): StyleRef {
  return { presetId: current.presetId, overrides: {} }
}

export function applyPresetToStyleRef(
  current: StyleRef | undefined,
  presetId: string,
  mode: "preserve" | "clean",
): StyleRef {
  if (mode === "clean") return { presetId, overrides: {} }
  return {
    presetId,
    overrides: omitTransformOverrides(current?.overrides),
  }
}

export function applyShadowShortcut(
  current: StyleRef | undefined,
  id: ShadowShortcutId,
): StyleRef {
  return patchStyleRef(current, "text.shadows", SHADOW_SHORTCUTS[id])
}

export function hasInsertOverrides(ref: StyleRef | undefined): boolean {
  return !isEmptyOverrides(ref?.overrides)
}

export function originTitle(origin: FieldOrigin): string {
  return `Origem: ${ORIGIN_LABEL[origin]}`
}

export type { DeepPartial, InsertStyle }
