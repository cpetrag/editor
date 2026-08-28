export type {
  AnimTarget,
  Animation,
  DeepPartial,
  InsertStyle,
  Preset,
  PresetGroup,
  Project,
  StyleLayer,
  StyleRef,
  TextStyle,
  Track,
  TrackId,
  UserPreset,
} from "./types.ts"
export {
  LEGADO_PRESET_ID,
  LEGADO_STYLE,
  PRESETS,
  getPresetStyle,
  FACTORY_PRESET_IDS,
  factoryPresetsInGroup,
  factoryPresetFontIds,
  DEFAULT_CTA_PRESET_ID,
  DEFAULT_CTA_STYLE_REF,
  canWritePresetId,
  setExtraPresets,
} from "./presets.ts"
export { deepMerge, hasPath } from "./deep-merge.ts"
export { fieldOrigin, resolveStyle } from "./resolve-style.ts"
export {
  ANIM_RECIPES,
  IDENTITY_POSE,
  animatedCssAt,
  animatedPoseAt,
  applyAnimRecipe,
  poseToCss,
  recipeFromAnimation,
} from "./anim-engine.ts"
export type { AnimPose, AnimRecipe, AnimRecipeName, AnimatedCss, AnimatedStyleInput } from "./anim-engine.ts"
export {
  ORIGIN_LABEL,
  SHADOW_SHORTCUTS,
  applyPresetToStyleRef,
  applyShadowShortcut,
  hasInsertOverrides,
  originTitle,
  patchStyleRef,
  resetStyleField,
  resetStyleOverrides,
  workingStyleRef,
} from "./edit-style.ts"
export type { FieldOrigin, ShadowShortcutId } from "./edit-style.ts"
export {
  AUTO_KEYWORD_RE,
  activeWordIndex,
  isKeywordToken,
  karaokeClipPath,
  karaokeProgress,
  wordHighlight,
} from "./highlight.ts"
export { backgroundCss, backgroundRects, layoutTextTokens, strokeCss } from "./text-paint.ts"
export { captionStyleToInsertStyle, resolveCaptionInsertStyle } from "./caption-map.ts"
export {
  captionPaintSkipReason,
  planStyledTextDraw,
  visibleGlyphCount,
  warnInvisibleCaptionPaint,
} from "./caption-draw.ts"
export {
  mapLegacyShadow,
  migrateInsertStyle,
  parseStyleRef,
  styleRefFromLegacy,
} from "./migrate.ts"
