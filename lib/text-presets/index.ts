export {
  TEXT_PRESET_SCHEMA,
  TEXT_PRESET_GROUPS,
  TEXT_PRESET_ANIM_KINDS,
  TEXT_PRESET_BOX_MODES,
  isTextPreset,
  assertTextPreset,
} from "./schema.ts"
export type {
  TextPreset,
  TextPresetAnim,
  TextPresetBox,
  TextPresetGroup,
  TextPresetShadow,
} from "./schema.ts"
export {
  TEXT_PRESET_IDS,
  TEXT_PRESETS,
  TEXT_PRESET_GROUP_LABELS,
  DEFAULT_TEXT_PRESET_ID,
  MIGRATED_TEXT_PRESET_ID,
  NEW_TEXT_FONT_SIZE,
  getTextPreset,
  isTextPresetId,
  textPresetsInGroup,
} from "./catalog.ts"
export type { TextPresetId } from "./catalog.ts"
export { renderTextPreset, wrapPresetLines } from "./render.ts"
export { autofitFontSize } from "./autofit.ts"
export { nextBoxMode, boxModeOfInsert, applyBoxMode } from "./fill.ts"
export {
  applyTextBackground,
  applyTextShadow,
  nudgeTextRadius,
  textBackgroundEnabledOf,
  textShadowEnabledOf,
  textRadiusOf,
} from "./bar.ts"
export type { TextPresetCss, TextPresetLayer, TextPresetRender, MeasureFn } from "./render.ts"
export {
  textPresetToInsertStyle,
  overlayComposeInsertStyle,
  paintTextPresetInsert,
  textPresetToComposeStyle,
  fontIdFromFamily,
} from "./to-insert-style.ts"
export type { TextPresetLayout } from "./to-insert-style.ts"
export {
  migrateTextPresetId,
  migrateTextInsert,
  migrateTextInserts,
  isLegacyTextPresetId,
} from "./migrate.ts"
export { applyFontFamily, applyTextPreset } from "./apply.ts"
export {
  TEXT_PRESET_FONT_FILES,
  ensureTextPresetFontsReady,
  isTextPresetFontLoaded,
  textPresetFontUrl,
} from "./fonts.ts"
