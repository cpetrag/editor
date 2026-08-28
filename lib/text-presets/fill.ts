import type { CompositionInsert } from "../composition.ts"
import { DEFAULT_TEXT_PRESET_ID, getTextPreset, isTextPresetId } from "./catalog.ts"
import { TEXT_PRESET_BOX_MODES, type TextPreset, type TextPresetBox, type TextPresetBoxMode } from "./schema.ts"
import { textPresetToComposeStyle } from "./to-insert-style.ts"

export function nextBoxMode(mode: TextPresetBoxMode): TextPresetBoxMode {
  const index = TEXT_PRESET_BOX_MODES.indexOf(mode)
  const next = TEXT_PRESET_BOX_MODES[(index + 1) % TEXT_PRESET_BOX_MODES.length]
  return next ?? "none"
}

function defaultBox(mode: TextPresetBoxMode): TextPresetBox {
  return {
    mode,
    color: "#111111",
    opacity: 0.88,
    radiusRatio: mode === "pill" ? 0.5 : 0.06,
    padXRatio: 0.045,
    padYRatio: 0.014,
  }
}

export function boxModeOfInsert(insert: CompositionInsert): TextPresetBoxMode {
  const presetId = isTextPresetId(insert.preset) ? insert.preset : DEFAULT_TEXT_PRESET_ID
  return getTextPreset(presetId).box?.mode ?? "none"
}

export function applyBoxMode(
  insert: CompositionInsert,
  mode: TextPresetBoxMode,
): Partial<CompositionInsert> {
  const presetId = isTextPresetId(insert.preset) ? insert.preset : DEFAULT_TEXT_PRESET_ID
  const preset = getTextPreset(presetId)
  const nextPreset: TextPreset = {
    ...preset,
    box: { ...(preset.box ?? defaultBox(mode)), mode },
  }
  return { style: textPresetToComposeStyle(nextPreset) }
}
