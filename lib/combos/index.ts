export {
  COMBO_TEMPLATE_SCHEMA,
  COMBO_TRACKS,
  COMBO_BEAT_KINDS,
  COMBO_ELEMENT_IDS,
  assertComboTemplate,
  isComboTemplate,
  isComboElementId,
} from "./schema.ts"
export type { ComboBeat, ComboBeatKind, ComboElementId, ComboTemplate, ComboTrack } from "./schema.ts"
export { COMBO_TEMPLATES, COMBO_TEMPLATE_IDS, getComboTemplate } from "./catalog.ts"
export { resolveBeatTime, comboVideoDuration, comboThumbTime, COMBO_PREVIEW_DURATION } from "./resolve.ts"
export { instantiateCombo, applyComboToInserts } from "./instantiate.ts"
export {
  COMBO_THUMB_W,
  COMBO_THUMB_H,
  COMBO_THUMB_CYCLE_MS,
  COMBO_THUMB_TRACKS,
  comboThumbCacheKey,
  fillNeutralStill,
  drawCoverFrame,
  drawComboOverlays,
  comboTrackTime,
} from "./thumb.ts"
