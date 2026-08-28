import { PLAY_W } from "../compose/layout.ts"
import { wrapLines } from "../compose/wrap-lines.ts"
import { DEFAULT_CHIP_FONT_SIZE, type CompositionInsert } from "../composition.ts"
import { elementMaxWidthPctOf, elementScaleOf, elementTextOf } from "./apply.ts"
import { getElementPreset } from "./catalog.ts"
import { splitBubbleCopy, wrapsElementShape } from "./copy.ts"
import type { ElementPreset } from "./schema.ts"

export function recipeForInsert(insert: CompositionInsert): ElementPreset | undefined {
  return getElementPreset(insert.type)
}

function charUnit(recipe: ElementPreset, fontPx: number): number {
  return fontPx * (recipe.fontFamily === "anton" || recipe.fontFamily === "archivo" ? 0.62 : 0.52)
}

function wrapCopy(text: string, maxPx: number, unit: number): string[] {
  if (!text) return []
  return wrapLines(text, maxPx, (value) => Math.max(value.length, 1) * unit)
}

function fontFactorOf(insert: CompositionInsert, recipe: ElementPreset): number {
  if (
    recipe.shape === "logo" ||
    recipe.shape === "circle" ||
    recipe.shape === "divider" ||
    recipe.shape === "hand-arrow"
  ) {
    return 1
  }
  return (insert.fontSize ?? DEFAULT_CHIP_FONT_SIZE) / DEFAULT_CHIP_FONT_SIZE
}

export function measureElementSize(
  insert: CompositionInsert,
  frameWidth = PLAY_W,
): { width: number; height: number } {
  const recipe = recipeForInsert(insert)
  const scale = elementScaleOf(insert)
  if (!recipe) {
    const fontSize = insert.fontSize ?? DEFAULT_CHIP_FONT_SIZE
    const factor = fontSize / DEFAULT_CHIP_FONT_SIZE
    const text = insert.text?.trim() ?? " "
    return {
      width: (28 + Math.max(text.length, 1) * 8) * factor * scale,
      height: 28 * factor * scale,
    }
  }
  const factor = fontFactorOf(insert, recipe)
  const height = recipe.heightRatio * frameWidth * scale
  const padX = recipe.padXRatio * frameWidth * scale
  const padY = recipe.padYRatio * frameWidth * scale
  const text = elementTextOf(insert)
  const fontPx = Math.max(12, height - padY * 2)
  const unit = charUnit(recipe, fontPx)

  if (recipe.shape === "arrow") {
    const labelH = text ? fontPx * 1.25 : 0
    const gap = text ? fontPx * 0.22 : 0
    const iconH = height
    const textW = text ? text.length * unit : 0
    const width = Math.max(recipe.minWidthRatio * frameWidth * scale, iconH * 0.72, textW + padX * 2)
    return { width: width * factor, height: (labelH + gap + iconH) * factor }
  }

  if (wrapsElementShape(recipe.shape)) {
    const cap = (elementMaxWidthPctOf(insert) / 100) * frameWidth
    const minW = recipe.minWidthRatio * frameWidth * scale
    if (recipe.shape === "bubble") {
      const avatar = height * 0.56
      const textMax = Math.max(48, cap - avatar - padX * 3)
      const { user, body } = splitBubbleCopy(text)
      const bodyUnit = unit * 0.58
      const bodyLines = wrapCopy(body, textMax, bodyUnit)
      const lineH = fontPx * 0.82
      const lineCount = Math.max(1, 1 + bodyLines.length)
      const contentH = Math.max(avatar, lineCount * lineH * 1.2)
      const longest = Math.max(
        user.length * fontPx * 0.42,
        ...bodyLines.map((line) => line.length * bodyUnit),
        minW - avatar - padX * 3,
      )
      return {
        width: Math.min(cap, Math.max(minW, avatar + padX * 3 + longest)) * factor,
        height: (padY * 2 + contentH + height * 0.18) * factor,
      }
    }
    const textMax = Math.max(48, cap - padX * 2)
    const lines = wrapCopy(text || " ", textMax, unit * 0.7)
    const starRow = fontPx * 1.25
    const lineH = fontPx * 0.82
    const longest = Math.max(
      starRow * 5.2,
      ...lines.map((line) => line.length * unit * 0.7),
      minW - padX * 2,
    )
    return {
      width: Math.min(cap, Math.max(minW, longest + padX * 2)) * factor,
      height: (padY * 2 + starRow + Math.max(lines.length, 1) * lineH * 1.2) * factor,
    }
  }

  let width = recipe.minWidthRatio * frameWidth * scale
  if (recipe.shape === "divider") {
    width = Math.max(width, 0.08 * frameWidth * scale)
  } else if (recipe.shape === "circle" || recipe.shape === "hand-arrow") {
    width = Math.max(width, height)
  } else if (recipe.shape === "logo") {
    width = Math.max(width, height * 1.15 + (text ? text.length * fontPx * 0.42 + padX : 0))
  } else {
    width = Math.max(width, padX * 2 + Math.max(text.length, 1) * unit)
  }
  if (recipe.shape === "banner") {
    width = Math.max(width, recipe.minWidthRatio * frameWidth * scale)
  }
  return { width: width * factor, height: height * factor }
}
