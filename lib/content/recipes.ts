import { insertKind, TEXT_INSERT_TYPE, type CompositionInsert } from "../composition.ts"
import { retentionZones, type RetentionCuts } from "../insert-ops.ts"
import { createInsert } from "../inserts.ts"
import { selectPack } from "../motion/select.ts"
import { getPresetStyle } from "../style/presets.ts"
import {
  contentPresetById,
  firstContentPreset,
  nextContentPreset,
  type ContentNiche,
  type ContentPreset,
  type ContentSlot,
} from "./presets.ts"

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
    ...(painted.text.rotation ? { rotation: painted.text.rotation } : {}),
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

function zoneHasText(inserts: CompositionInsert[], from: number, to: number): boolean {
  return inserts.some((insert) => {
    if (insertKind(insert) !== "text") return false
    const end = insert.start + insert.duration
    return insert.start < to && from < end
  })
}

/**
 * Receitas do nicho só nos marcadores que ainda não têm texto.
 * Prova ganha a receita de prova no início e a de oferta no meio.
 */
export function recipeInsertsForEmptyMarkers(input: {
  duration: number
  niche: ContentNiche
  inserts: CompositionInsert[]
  cuts?: RetentionCuts | null
  productData?: import("./runs.ts").ProductData
  idFor?: (index: number) => string
}): CompositionInsert[] {
  const zones = retentionZones(input.duration, input.cuts)
  const created: CompositionInsert[] = []

  const push = (slot: ContentSlot, start: number, duration: number) => {
    const recipe = firstContentPreset(slot, input.niche, input.productData)
    if (!recipe || !(duration > 0.05)) return
    const base = createInsert(TEXT_INSERT_TYPE) as CompositionInsert
    const next = applyContentRecipe(base, recipe)
    const index = created.length
    created.push({
      ...next,
      ...(input.idFor ? { id: input.idFor(index) } : {}),
      start,
      duration,
    })
  }

  for (const zone of zones) {
    const length = zone.to - zone.from
    if (!(length > 0.05)) continue
    if (zoneHasText(input.inserts, zone.from, zone.to)) continue
    if (zone.id === "gancho") {
      push("gancho", zone.from, Math.min(3, length))
      continue
    }
    if (zone.id === "prova") {
      const half = length / 2
      const each = Math.min(3, half)
      push("prova", zone.from, each)
      push("oferta", zone.from + half, each)
      continue
    }
    push("cta", zone.from, length)
  }

  return created
}

export function recipeOf(id: string): ContentPreset | undefined {
  return contentPresetById(id)
}
