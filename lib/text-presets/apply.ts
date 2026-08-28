import { insertKind, type CompositionInsert } from "../composition.ts"
import { parseFontId, patchInsertStyle } from "../compose/insert-style.ts"
import { patchStyleRef } from "../style/edit-style.ts"
import { LEGADO_PRESET_ID } from "../style/presets.ts"
import { getTextPreset, isTextPresetId, type TextPresetId } from "./catalog.ts"
import { fontIdFromFamily, textPresetToComposeStyle } from "./to-insert-style.ts"

export function applyTextPreset(insert: CompositionInsert, presetId: string): CompositionInsert {
  if (insertKind(insert) !== "text") return insert
  if (!isTextPresetId(presetId)) return insert
  const preset = getTextPreset(presetId)
  const { style: _ignored, ...rest } = insert
  return {
    ...rest,
    preset: preset.id as TextPresetId,
    fontFamily: fontIdFromFamily(preset.font.family),
    style: textPresetToComposeStyle(preset),
    styleRef: {
      presetId: LEGADO_PRESET_ID,
      overrides: {},
    },
  }
}

/** Keep top-level fontFamily and compose style in sync — the canvas paints style.fontFamily. */
export function applyFontFamily(
  insert: CompositionInsert,
  family: string,
): Partial<CompositionInsert> {
  const fontFamily = parseFontId(fontIdFromFamily(family)) ?? parseFontId(family)
  if (!fontFamily) return {}
  return {
    fontFamily,
    style: patchInsertStyle(insert, { fontFamily }),
    styleRef: patchStyleRef(insert.styleRef ?? { presetId: LEGADO_PRESET_ID, overrides: {} }, "text.fontFamily", fontFamily),
  }
}
