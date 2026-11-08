import type { CompositionInsert } from "../composition.ts"
import { selectPack } from "../motion/select.ts"
import { getPresetStyle } from "../style/presets.ts"
import { contentPresetById, nextContentPreset, type ContentPreset } from "./presets.ts"

export function applyContentRecipe(
  insert: CompositionInsert,
  recipe: ContentPreset,
): CompositionInsert {
  const painted = getPresetStyle(recipe.style)
  const animation = selectPack(painted.animation, recipe.pack)
  const role = recipe.slot === "oferta" ? undefined : recipe.slot
  return {
    ...insert,
    text: recipe.text,
    y: recipe.y,
    contentId: recipe.id,
    ...(role ? { role } : { role: undefined }),
    fontSize: painted.text.fontSize,
    fontFamily: painted.text.fontFamily,
    styleRef: {
      presetId: recipe.style,
      overrides: {
        animation,
        text: { y: recipe.y },
      },
    },
  }
}

export function rerollContentRecipe(
  insert: CompositionInsert,
  seed: string,
): CompositionInsert {
  if (!insert.contentId) return insert
  const next = nextContentPreset(insert.contentId, seed)
  if (!next || next.id === insert.contentId) return insert
  return applyContentRecipe(insert, next)
}

export function recipeOf(id: string): ContentPreset | undefined {
  return contentPresetById(id)
}
