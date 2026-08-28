import type { CaptionStyle, CompositionInsert, StyleRef } from "./composition.ts"
import { isEmptyOverrides } from "./style/deep-merge.ts"
import type { DeepPartial, InsertStyle } from "./style/types.ts"

export type InsertTransform = {
  x: number
  y: number
  scale: number
  rotation: number
  maxWidth: number
  touchedByUser: boolean
}

const DEFAULT_TEXT_X = 50
const DEFAULT_TEXT_Y = 35
const DEFAULT_CAPTION_X = 50
const DEFAULT_CAPTION_Y = 72
const DEFAULT_CAPTION_ROTATION = 0
const DEFAULT_CAPTION_MAX_WIDTH = 84
const DEFAULT_STICKER_X = 50
const DEFAULT_STICKER_Y = 78
const DEFAULT_STICKER_SCALE = 0.7
const DEFAULT_MAX_WIDTH_PCT = 84

function kindOf(insert: CompositionInsert): "chip" | "text" | "sticker" | "caption" | undefined {
  if (insert.kind) return insert.kind
  if (insert.type === "legenda") return "caption"
  if (insert.type === "texto-livre") return "text"
  if (insert.type === "sticker-png") return "sticker"
  if (insert.type) return "chip"
  return undefined
}

const TRANSFORM_TEXT_KEYS = ["x", "y", "rotation", "maxWidth"] as const

export function isTransformStylePath(path: string): boolean {
  return (
    path === "text.x" ||
    path === "text.y" ||
    path === "text.rotation" ||
    path === "text.maxWidth"
  )
}

export function defaultTransformForInsert(insert: CompositionInsert): InsertTransform {
  const kind = kindOf(insert)
  if (kind === "sticker") {
    return {
      x: DEFAULT_STICKER_X,
      y: DEFAULT_STICKER_Y,
      scale: DEFAULT_STICKER_SCALE,
      rotation: 0,
      maxWidth: DEFAULT_MAX_WIDTH_PCT,
      touchedByUser: false,
    }
  }
  if (kind === "caption") {
    return {
      x: DEFAULT_CAPTION_X,
      y: DEFAULT_CAPTION_Y,
      scale: 1,
      rotation: 0,
      maxWidth: DEFAULT_MAX_WIDTH_PCT,
      touchedByUser: false,
    }
  }
  return {
    x: DEFAULT_TEXT_X,
    y: DEFAULT_TEXT_Y,
    scale: 1,
    rotation: 0,
    maxWidth: DEFAULT_MAX_WIDTH_PCT,
    touchedByUser: false,
  }
}

export function omitTransformOverrides(
  overrides: DeepPartial<InsertStyle> | undefined,
): DeepPartial<InsertStyle> {
  if (!overrides) return {}
  const text = overrides.text
  if (!text) return overrides
  const nextText: DeepPartial<InsertStyle["text"]> = { ...text }
  for (const key of TRANSFORM_TEXT_KEYS) {
    delete nextText[key]
  }
  const next: DeepPartial<InsertStyle> = { ...overrides, text: nextText }
  if (isEmptyOverrides(next.text)) {
    const { text: _text, ...rest } = next
    return rest
  }
  return next
}

function stripTransformStyleRef(ref: StyleRef | undefined): StyleRef | undefined {
  if (!ref) return ref
  return {
    presetId: ref.presetId,
    overrides: omitTransformOverrides(ref.overrides),
  }
}

export function layoutTransform(
  insert: CompositionInsert,
  painted: InsertStyle,
): InsertTransform {
  const fallback = defaultTransformForInsert(insert)
  if (insert.transform?.touchedByUser) {
    return {
      x: insert.transform.x,
      y: insert.transform.y,
      scale: insert.transform.scale,
      rotation: insert.transform.rotation,
      maxWidth: insert.transform.maxWidth,
      touchedByUser: true,
    }
  }
  return {
    x: painted.text.x,
    y: painted.text.y,
    scale: insert.scale ?? fallback.scale,
    rotation: painted.text.rotation,
    maxWidth: painted.text.maxWidth,
    touchedByUser: false,
  }
}

export function applyUserTransformPatch(
  insert: CompositionInsert,
  patch: Partial<Pick<InsertTransform, "x" | "y" | "scale" | "rotation" | "maxWidth">>,
  fallback: InsertTransform,
): CompositionInsert {
  const base = insert.transform ?? fallback
  const next: InsertTransform = {
    x: patch.x ?? base.x,
    y: patch.y ?? base.y,
    scale: patch.scale ?? base.scale,
    rotation: patch.rotation ?? base.rotation,
    maxWidth: patch.maxWidth ?? base.maxWidth,
    touchedByUser: true,
  }
  return {
    ...insert,
    transform: next,
    x: next.x,
    y: next.y,
    rotation: next.rotation,
    maxWidthPct: next.maxWidth,
    scale: next.scale,
  }
}

export function resetInsertTransform(insert: CompositionInsert): CompositionInsert {
  const next: CompositionInsert = {
    ...insert,
    transform: undefined,
    styleRef: stripTransformStyleRef(insert.styleRef),
  }
  const kind = kindOf(insert)
  if (kind === "caption") {
    delete next.x
    delete next.y
    delete next.rotation
    delete next.maxWidthPct
    return next
  }
  const fallback = defaultTransformForInsert(insert)
  return {
    ...next,
    x: fallback.x,
    y: fallback.y,
    rotation: fallback.rotation,
    maxWidthPct: fallback.maxWidth,
    ...(kind === "sticker" ? { scale: fallback.scale } : {}),
  }
}

function asFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function captionStyleLooksTouched(style: CaptionStyle | undefined): boolean {
  if (!style) return false
  return (
    style.x !== DEFAULT_CAPTION_X ||
    style.y !== DEFAULT_CAPTION_Y ||
    style.rotation !== DEFAULT_CAPTION_ROTATION ||
    style.maxWidthPct !== DEFAULT_CAPTION_MAX_WIDTH
  )
}

export function migrateInsertTransform(
  insert: CompositionInsert,
  captionStyle?: CaptionStyle,
): CompositionInsert {
  if (insert.transform?.touchedByUser) return insert
  if (kindOf(insert) === "chip") return insert
  const fallback = defaultTransformForInsert(insert)
  const text = insert.styleRef?.overrides.text
  const fromOverride: Partial<InsertTransform> = {
    x: asFinite(text?.x),
    y: asFinite(text?.y),
    rotation: asFinite(text?.rotation),
    maxWidth: asFinite(text?.maxWidth),
  }
  const fromFlat: Partial<InsertTransform> = {
    x: asFinite(insert.x),
    y: asFinite(insert.y),
    rotation: asFinite(insert.rotation),
    maxWidth: asFinite(insert.maxWidthPct),
    scale: asFinite(insert.scale),
  }
  const overrideTouched = TRANSFORM_TEXT_KEYS.some((key) => fromOverride[key] !== undefined)
  const flatTouched =
    kindOf(insert) === "caption" &&
    (fromFlat.x !== undefined ||
      fromFlat.y !== undefined ||
      fromFlat.rotation !== undefined ||
      fromFlat.maxWidth !== undefined)
  const textMoved =
    kindOf(insert) === "text" &&
    ((fromFlat.x !== undefined && fromFlat.x !== DEFAULT_TEXT_X) ||
      (fromFlat.y !== undefined && fromFlat.y !== DEFAULT_TEXT_Y) ||
      (fromFlat.rotation !== undefined && fromFlat.rotation !== 0) ||
      (fromFlat.maxWidth !== undefined && fromFlat.maxWidth !== DEFAULT_MAX_WIDTH_PCT))
  const stickerMoved =
    kindOf(insert) === "sticker" &&
    ((fromFlat.x !== undefined && fromFlat.x !== DEFAULT_STICKER_X) ||
      (fromFlat.y !== undefined && fromFlat.y !== DEFAULT_STICKER_Y) ||
      (fromFlat.scale !== undefined && fromFlat.scale !== DEFAULT_STICKER_SCALE) ||
      (fromFlat.rotation !== undefined && fromFlat.rotation !== 0))
  const globalTouched =
    kindOf(insert) === "caption" &&
    !overrideTouched &&
    !flatTouched &&
    captionStyleLooksTouched(captionStyle)

  if (!overrideTouched && !flatTouched && !textMoved && !stickerMoved && !globalTouched) {
    return insert
  }

  const global = globalTouched && captionStyle
    ? {
        x: captionStyle.x,
        y: captionStyle.y,
        rotation: captionStyle.rotation,
        maxWidth: captionStyle.maxWidthPct,
      }
    : {}

  const next: InsertTransform = {
    x: fromOverride.x ?? fromFlat.x ?? global.x ?? fallback.x,
    y: fromOverride.y ?? fromFlat.y ?? global.y ?? fallback.y,
    scale: fromFlat.scale ?? fallback.scale,
    rotation: fromOverride.rotation ?? fromFlat.rotation ?? global.rotation ?? fallback.rotation,
    maxWidth: fromOverride.maxWidth ?? fromFlat.maxWidth ?? global.maxWidth ?? fallback.maxWidth,
    touchedByUser: true,
  }
  return {
    ...insert,
    transform: next,
    styleRef: stripTransformStyleRef(insert.styleRef),
    x: next.x,
    y: next.y,
    rotation: next.rotation,
    maxWidthPct: next.maxWidth,
    scale: next.scale,
  }
}

export function parseInsertTransform(raw: unknown): InsertTransform | undefined {
  if (typeof raw !== "object" || raw === null) return undefined
  const record = raw as Record<string, unknown>
  const x = asFinite(record.x)
  const y = asFinite(record.y)
  if (x === undefined || y === undefined) return undefined
  return {
    x,
    y,
    scale: asFinite(record.scale) ?? 1,
    rotation: asFinite(record.rotation) ?? 0,
    maxWidth: asFinite(record.maxWidth) ?? DEFAULT_MAX_WIDTH_PCT,
    touchedByUser: record.touchedByUser === true,
  }
}

export function transformPatchFromInsertPatch(
  patch: Partial<CompositionInsert>,
): Partial<Pick<InsertTransform, "x" | "y" | "scale" | "rotation" | "maxWidth">> | null {
  const next: Partial<Pick<InsertTransform, "x" | "y" | "scale" | "rotation" | "maxWidth">> = {}
  if (typeof patch.x === "number") next.x = patch.x
  if (typeof patch.y === "number") next.y = patch.y
  if (typeof patch.scale === "number") next.scale = patch.scale
  if (typeof patch.rotation === "number") next.rotation = patch.rotation
  if (typeof patch.maxWidthPct === "number") next.maxWidth = patch.maxWidthPct
  if (patch.transform) {
    if (typeof patch.transform.x === "number") next.x = patch.transform.x
    if (typeof patch.transform.y === "number") next.y = patch.transform.y
    if (typeof patch.transform.scale === "number") next.scale = patch.transform.scale
    if (typeof patch.transform.rotation === "number") next.rotation = patch.transform.rotation
    if (typeof patch.transform.maxWidth === "number") next.maxWidth = patch.transform.maxWidth
  }
  return Object.keys(next).length > 0 ? next : null
}

export function transformPatchFromStylePath(
  path: string,
  value: unknown,
): Partial<Pick<InsertTransform, "x" | "y" | "rotation" | "maxWidth">> | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (path === "text.x") return { x: value }
  if (path === "text.y") return { y: value }
  if (path === "text.rotation") return { rotation: value }
  if (path === "text.maxWidth") return { maxWidth: value }
  return null
}
