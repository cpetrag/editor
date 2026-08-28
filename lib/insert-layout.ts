import type { AnimPresetId, CompositionInsert, InsertAnchor } from "./composition.ts"
import { DEFAULT_CHIP_FONT_SIZE, DEFAULT_CHIP_SCALE, isChipInsert } from "./composition.ts"
import { canvasFontFamily } from "./compose/fonts.ts"
import {
  clampFontWeight,
  parseFontId,
  resolveInsertStyle,
  type FontId,
  type FontWeight,
  type InsertStyle,
} from "./compose/insert-style.ts"
import { PLAY_W } from "./compose/layout.ts"
import {
  elementColorsOf,
  elementTextOf,
  measureElementSize,
  recipeForInsert,
  wrapsElementText,
  type ElementShape,
} from "./elements/index.ts"
import { LEGADO_PRESET_ID } from "./style/presets.ts"
import { resolveStyle } from "./style/resolve-style.ts"
import { trackStyleForInsert } from "./style-preset.ts"
import type { Animation, StyleLayer, TrackId } from "./style/types.ts"

export type ChipStyleContext = {
  project?: StyleLayer
  tracks?: Partial<Record<TrackId, StyleLayer>>
  videoDuration?: number
}

export interface ChipLayout {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  fill: string
  strike: boolean
  showStar: boolean
  fontFamily: string
  mode: "text" | "logo" | "icon"
  logoSrc?: string
  paint: InsertStyle
  fontPx: number
  shape: ElementShape
  primary: string
  secondary: string
  radius: number
  elementShadow: "none" | "hard" | "soft"
  factoryAnim?: Animation
  start: number
  duration: number
  animIn: AnimPresetId
  animOut: AnimPresetId
}

export const CHIP_HEIGHT = 70
const GAP = 12
const FRAME_PAD = 24

function isActive(insert: CompositionInsert, time: number): boolean {
  return time >= insert.start && time < insert.start + insert.duration
}

function animCopy(insert: CompositionInsert) {
  return {
    start: insert.start,
    duration: insert.duration,
    animIn: insert.animIn,
    animOut: insert.animOut,
  }
}

export function chipHasFreePosition(insert: CompositionInsert): boolean {
  return typeof insert.x === "number" && typeof insert.y === "number"
}

function chipDrawFontPx(insert: CompositionInsert, height: number): number {
  const scale = insert.scale ?? DEFAULT_CHIP_SCALE
  const fontSize = insert.fontSize ?? DEFAULT_CHIP_FONT_SIZE
  const fromBox = Math.max(12, Math.round(height * 0.42))
  const fromField = Math.max(11, Math.round(fontSize * scale * (height / 70)))
  return Math.max(fromBox, fromField)
}

export function measureChipSize(insert: CompositionInsert): { width: number; height: number } {
  return measureElementSize(insert, PLAY_W)
}

function placeGroup(
  chips: ChipLayout[],
  anchor: InsertAnchor,
  frame: { width: number; height: number },
): ChipLayout[] {
  if (chips.length === 0) return []
  const totalHeight = chips.reduce(
    (sum, chip, index) => sum + chip.height + (index > 0 ? GAP : 0),
    0,
  )
  let y: number
  if (anchor === "top") {
    y = FRAME_PAD
  } else if (anchor === "center") {
    y = (frame.height - totalHeight) / 2
  } else {
    y = frame.height - FRAME_PAD - totalHeight
  }
  let top = y
  return chips.map((chip) => {
    const placed = {
      ...chip,
      x: (frame.width - chip.width) / 2,
      y: top,
    }
    top += chip.height + GAP
    return placed
  })
}

function opacityToUnit(value: number): number {
  if (value > 1) return Math.min(1, Math.max(0, value / 100))
  return Math.min(1, Math.max(0, value))
}

function chipFactoryLook(
  insert: CompositionInsert,
  brandFontId: string,
  context?: ChipStyleContext,
): { paint: InsertStyle; factoryAnim?: Animation } {
  const base = resolveInsertStyle(insert, brandFontId)
  const duration = context?.videoDuration ?? 0
  const track =
    duration > 0 ? trackStyleForInsert(insert, context?.tracks, duration) : null
  const project = context?.project ?? {}
  const ref = insert.styleRef ?? track?.styleRef ?? project.styleRef
  if (!ref || ref.presetId === LEGADO_PRESET_ID) {
    return { paint: base }
  }
  const painted = resolveStyle(insert, track, project)
  const fontId = (parseFontId(painted.text.fontFamily) ?? parseFontId(brandFontId) ?? "geist") as FontId
  const fontPx = chipDrawFontPx(insert, CHIP_HEIGHT)
  const strokeScale = painted.text.fontSize > 0 ? fontPx / painted.text.fontSize : 1
  return {
    paint: {
      ...base,
      fontFamily: fontId,
      fontWeight: clampFontWeight(fontId, painted.text.fontWeight as FontWeight),
      uppercase: painted.text.textTransform === "uppercase",
      color: painted.text.color,
      bgColor: painted.text.background.enabled ? painted.text.background.color : base.bgColor,
      strokeWidth: painted.text.stroke.enabled
        ? Math.min(4, Math.max(0, painted.text.stroke.width * strokeScale))
        : 0,
      strokeColor: painted.text.stroke.color,
      shadow: painted.text.shadows.length > 0 ? "soft" : base.shadow,
      opacity: opacityToUnit(painted.text.opacity),
      rotation: painted.text.rotation,
    },
    factoryAnim: painted.animation,
  }
}

function applyInsertRotation(paint: InsertStyle, insert: CompositionInsert): InsertStyle {
  if (typeof insert.rotation !== "number" || !Number.isFinite(insert.rotation)) return paint
  return { ...paint, rotation: insert.rotation }
}

function makeChip(
  insert: CompositionInsert,
  brandFontId: string,
  logoSrc: string,
  context?: ChipStyleContext,
): ChipLayout | null {
  const recipe = recipeForInsert(insert)
  if (!recipe) return null
  const size = measureChipSize(insert)
  const look = chipFactoryLook(insert, brandFontId, context)
  const paint = applyInsertRotation(look.paint, insert)
  const colors = elementColorsOf(insert)
  const duration = context?.videoDuration ?? 0
  const track = duration > 0 ? trackStyleForInsert(insert, context?.tracks, duration) : null
  const project = context?.project ?? {}
  const ref = insert.styleRef ?? track?.styleRef ?? project.styleRef
  const factory = Boolean(ref && ref.presetId !== LEGADO_PRESET_ID)
  const primary = insert.fillColor ? colors.primary : factory && paint.bgColor ? paint.bgColor : colors.primary
  const secondary = insert.accentColor ? colors.secondary : factory ? paint.color : colors.secondary
  const fontId = (
    parseFontId(factory ? paint.fontFamily : recipe.fontFamily) ??
    parseFontId(recipe.fontFamily) ??
    parseFontId(brandFontId) ??
    "inter"
  ) as FontId
  const fontFamily = canvasFontFamily(fontId)
  const content = elementTextOf(insert)
  const scale = insert.scale && insert.scale > 0 ? insert.scale : 1
  const fontPx = chipDrawFontPx(insert, recipe.heightRatio * PLAY_W * scale)
  const radius = wrapsElementText(insert)
    ? Math.min(18 * scale, Math.max(10, size.height * 0.1))
    : recipe.radiusRatio >= 0.5
      ? size.height / 2
      : recipe.radiusRatio * PLAY_W * scale
  const mode: ChipLayout["mode"] = recipe.shape === "logo" ? "logo" : content ? "text" : "icon"
  return {
    id: insert.id,
    ...animCopy(insert),
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    text: content,
    fill: primary,
    strike: recipe.shape === "price",
    showStar: recipe.shape === "stars",
    fontFamily,
    mode,
    ...(recipe.shape === "logo" && logoSrc ? { logoSrc } : {}),
    paint: {
      ...paint,
      fontFamily: fontId,
      fontWeight: factory ? paint.fontWeight : recipe.fontWeight,
      uppercase: factory ? paint.uppercase : recipe.uppercase,
      color: secondary,
      bgColor: primary,
      shadow: factory ? paint.shadow : recipe.shadow,
    },
    fontPx,
    shape: recipe.shape,
    primary,
    secondary,
    radius,
    elementShadow: recipe.shadow,
    ...(look.factoryAnim ? { factoryAnim: look.factoryAnim } : {}),
  }
}

export function layoutInserts(
  inserts: CompositionInsert[],
  time: number,
  frame: { width: number; height: number },
  fontFamily: string,
  logoSrc = "",
  styleContext?: ChipStyleContext,
): ChipLayout[] {
  const active = inserts.filter(
    (insert) => isChipInsert(insert) && isActive(insert, time),
  )
  const grouped: Record<InsertAnchor, ChipLayout[]> = {
    top: [],
    center: [],
    bottom: [],
  }
  const placed: ChipLayout[] = []

  for (const insert of active) {
    const chip = makeChip(insert, fontFamily, logoSrc, styleContext)
    if (!chip) continue
    if (chipHasFreePosition(insert)) {
      const cx = ((insert.x as number) / 100) * frame.width
      const cy = ((insert.y as number) / 100) * frame.height
      placed.push({
        ...chip,
        x: cx - chip.width / 2,
        y: cy - chip.height / 2,
      })
      continue
    }
    grouped[insert.anchor].push(chip)
  }

  return [
    ...placeGroup(grouped.top, "top", frame),
    ...placeGroup(grouped.center, "center", frame),
    ...placeGroup(grouped.bottom, "bottom", frame),
    ...placed,
  ]
}

export function chipPlayBox(chip: ChipLayout): {
  cx: number
  cy: number
  w: number
  h: number
  rotation: number
} {
  return {
    cx: chip.x + chip.width / 2,
    cy: chip.y + chip.height / 2,
    w: chip.width,
    h: chip.height,
    rotation: chip.paint.rotation,
  }
}
