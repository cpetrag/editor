import {
  DEFAULT_CHIP_SCALE,
  DEFAULT_STICKER_SCALE,
  DEFAULT_STICKER_X,
  DEFAULT_STICKER_Y,
  DEFAULT_TEXT_FONT_SIZE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  SCALE_MAX,
  SCALE_MIN,
  insertKind,
  type CompositionInsert,
} from "../composition.ts"
import { chipHasFreePosition, measureChipSize } from "../insert-layout.ts"
import { PLAY_H, PLAY_W } from "./layout.ts"
import { SELECTION_PAD_PX, layoutInsertText, type TextLayout, type TextMeasure } from "./layout-text.ts"

export interface PlayBox {
  cx: number
  cy: number
  w: number
  h: number
  rotation?: number
}

export interface Point {
  x: number
  y: number
}

export interface NaturalSize {
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function textPlayBox(layout: TextLayout): PlayBox {
  return {
    cx: layout.cx,
    cy: layout.cy,
    w: layout.blockW + SELECTION_PAD_PX * 2,
    h: layout.blockH + SELECTION_PAD_PX * 2,
    rotation: layout.rotation,
  }
}

export function approxBox(
  insert: CompositionInsert,
  _displayScale = 1,
  naturalSize?: NaturalSize,
  stackedChipBox?: PlayBox | null,
  brandFontId = "geist",
  measureWidth?: TextMeasure,
  textLayout?: TextLayout | null,
): PlayBox | null {
  const kind = insertKind(insert)
  if (kind === "chip") {
    if (stackedChipBox && !chipHasFreePosition(insert)) return stackedChipBox
    if (!chipHasFreePosition(insert)) return stackedChipBox ?? null
    const size = measureChipSize(insert)
    return {
      cx: ((insert.x as number) / 100) * PLAY_W,
      cy: ((insert.y as number) / 100) * PLAY_H,
      w: size.width,
      h: size.height,
      rotation: insert.rotation ?? insert.style?.rotation ?? 0,
    }
  }

  if (kind === "sticker") {
    const scale = insert.scale ?? DEFAULT_STICKER_SCALE
    const dw = PLAY_W * scale
    const naturalW = naturalSize?.width ?? 1
    const naturalH = naturalSize?.height ?? 1
    const dh = naturalW > 0 ? dw * (naturalH / naturalW) : dw
    return {
      cx: ((insert.x ?? DEFAULT_STICKER_X) / 100) * PLAY_W,
      cy: ((insert.y ?? DEFAULT_STICKER_Y) / 100) * PLAY_H,
      w: dw,
      h: dh,
      rotation: insert.rotation ?? 0,
    }
  }

  const layout = textLayout ?? layoutInsertText(insert, brandFontId, { width: PLAY_W, height: PLAY_H }, measureWidth)
  if (!layout) return null
  return textPlayBox(layout)
}

export function scaleFactorFromDrag(
  center: Point,
  pointer: Point,
  startDist: number,
): number {
  if (startDist < 1) return 1
  return Math.hypot(pointer.x - center.x, pointer.y - center.y) / startDist
}

export function resizePatchForTrack(
  insert: CompositionInsert,
  factor: number,
): Partial<CompositionInsert> {
  const kind = insertKind(insert)
  if (kind === "text" || kind === "caption") {
    const base = insert.fontSize ?? DEFAULT_TEXT_FONT_SIZE
    return {
      fontSize: clamp(Math.round(base * factor), FONT_SIZE_MIN, FONT_SIZE_MAX),
    }
  }
  if (kind === "sticker" || kind === "chip") {
    const base = insert.scale ?? (kind === "chip" ? DEFAULT_CHIP_SCALE : DEFAULT_STICKER_SCALE)
    return {
      scale: clamp(Math.round(base * factor * 1000) / 1000, SCALE_MIN, SCALE_MAX),
    }
  }
  return {}
}

function contains(box: PlayBox, playX: number, playY: number): boolean {
  const dx = playX - box.cx
  const dy = playY - box.cy
  const rotation = box.rotation ?? 0
  let localX = dx
  let localY = dy
  if (rotation) {
    const rad = (-rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    localX = dx * cos - dy * sin
    localY = dx * sin + dy * cos
  }
  return Math.abs(localX) <= box.w / 2 && Math.abs(localY) <= box.h / 2
}

export function hitTestOverlays(
  inserts: CompositionInsert[],
  playX: number,
  playY: number,
  displayScale = 1,
  naturals: ReadonlyMap<string, NaturalSize> = new Map(),
  chipBoxes: ReadonlyMap<string, PlayBox> = new Map(),
  brandFontId = "geist",
  textLayouts: ReadonlyMap<string, TextLayout> = new Map(),
): CompositionInsert | null {
  const captions: CompositionInsert[] = []
  const texts: CompositionInsert[] = []
  const stickers: CompositionInsert[] = []
  const chips: CompositionInsert[] = []
  for (const insert of inserts) {
    const kind = insertKind(insert)
    if (kind === "caption") captions.push(insert)
    else if (kind === "text") texts.push(insert)
    else if (kind === "sticker") stickers.push(insert)
    else if (kind === "chip") chips.push(insert)
  }
  for (const insert of [...captions].reverse()) {
    const box = approxBox(
      insert,
      displayScale,
      naturals.get(insert.id),
      null,
      brandFontId,
      undefined,
      textLayouts.get(insert.id) ?? null,
    )
    if (box && contains(box, playX, playY)) return insert
  }
  for (const insert of [...texts].reverse()) {
    const box = approxBox(
      insert,
      displayScale,
      naturals.get(insert.id),
      null,
      brandFontId,
      undefined,
      textLayouts.get(insert.id) ?? null,
    )
    if (box && contains(box, playX, playY)) return insert
  }
  for (const insert of [...stickers].reverse()) {
    const box = approxBox(insert, displayScale, naturals.get(insert.id))
    if (box && contains(box, playX, playY)) return insert
  }
  for (const insert of [...chips].reverse()) {
    const box = approxBox(insert, displayScale, undefined, chipBoxes.get(insert.id) ?? null)
    if (box && contains(box, playX, playY)) return insert
  }
  return null
}
