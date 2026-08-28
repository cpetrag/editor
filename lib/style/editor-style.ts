import type { AnimPresetId, CompositionInsert } from "../composition.ts"
import { TEXT_PRESETS } from "../compose/presets.ts"
import { LEGADO_PRESET_ID } from "./presets.ts"
import { resolveInsertStyle } from "./resolve-insert-style.ts"
import { recipeFromAnimation, type AnimRecipeName } from "./anim-engine.ts"
import type { InsertStyle, StyleLayer } from "./types.ts"

const RECIPE_ANIM_IN: ReadonlySet<string> = new Set([
  "pop",
  "slide-up",
  "blur-in",
  "typewriter",
])

export function usesFactoryPaint(
  insert: StyleLayer,
  track: StyleLayer | null,
  project: StyleLayer,
): boolean {
  const ref = insert.styleRef ?? track?.styleRef ?? project.styleRef
  return Boolean(ref && ref.presetId !== LEGADO_PRESET_ID)
}

export function resolveStyleForEditor(
  insert: CompositionInsert,
  track: StyleLayer | null,
  project: StyleLayer,
): InsertStyle {
  const resolved = resolveInsertStyle(insert, { project, track })
  const withTransform = insert.transform?.touchedByUser
    ? {
        ...resolved,
        text: {
          ...resolved.text,
          x: insert.transform.x,
          y: insert.transform.y,
          rotation: insert.transform.rotation,
          maxWidth: insert.transform.maxWidth,
        },
      }
    : resolved
  if (usesFactoryPaint(insert, track, project)) return withTransform
  return {
    ...withTransform,
    text: {
      ...withTransform.text,
      ...(typeof insert.fontSize === "number" ? { fontSize: insert.fontSize } : {}),
      ...(typeof insert.x === "number" ? { x: insert.x } : {}),
      ...(typeof insert.y === "number" ? { y: insert.y } : {}),
      ...(typeof insert.rotation === "number" ? { rotation: insert.rotation } : {}),
    },
  }
}

export function activeAnimRecipe(
  insert: CompositionInsert,
  resolved: InsertStyle,
  track: StyleLayer | null = null,
  project: StyleLayer = {},
): AnimRecipeName | null {
  if (usesFactoryPaint(insert, track, project)) {
    return recipeFromAnimation(resolved.animation)
  }
  if (insert.animIn && RECIPE_ANIM_IN.has(insert.animIn)) {
    return insert.animIn as AnimRecipeName
  }
  return recipeFromAnimation(resolved.animation)
}

export function legadoPaintLabel(preset: string | undefined): string | undefined {
  if (!preset) return undefined
  return TEXT_PRESETS.find((item) => item.id === preset)?.label
}

export function legacyInsertPatchFromStylePath(
  path: string,
  value: unknown,
): Partial<CompositionInsert> {
  if (path === "text.fontSize" && typeof value === "number") return { fontSize: value }
  if (path === "text.x" && typeof value === "number") return { x: value }
  if (path === "text.y" && typeof value === "number") return { y: value }
  if (path === "text.maxWidth" && typeof value === "number") return { maxWidthPct: value }
  if (path === "text.rotation" && typeof value === "number") return { rotation: value }
  if (path === "animation" && value && typeof value === "object") {
    const recipe = recipeFromAnimation(value as InsertStyle["animation"])
    if (recipe && RECIPE_ANIM_IN.has(recipe)) return { animIn: recipe as AnimPresetId }
  }
  return {}
}
