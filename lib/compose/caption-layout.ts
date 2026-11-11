import {
  insertKind,
  type CaptionPreset,
  type CaptionStyle,
  type CompositionInsert,
} from "../composition.ts"
import { layoutTransform } from "../insert-transform.ts"
import { parseFontId, type FontWeight } from "./insert-style.ts"
import { resolveCaptionInsertStyle } from "../style/caption-map.ts"
import { patchStyleRef } from "../style/edit-style.ts"
import { offerStylePatch } from "../style/offer-styles.ts"
import { usesFactoryPaint } from "../style/editor-style.ts"
import { LEGADO_PRESET_ID } from "../style/presets.ts"
import { resolveStyle } from "../style/resolve-style.ts"
import type { InsertStyle, StyleLayer } from "../style/types.ts"

function opacityToUnit(value: number): number {
  if (value > 1) return Math.min(1, Math.max(0, value / 100))
  return Math.min(1, Math.max(0, value))
}

export function stampPaintedLayout(
  insert: CompositionInsert,
  painted: InsertStyle,
): CompositionInsert {
  const kind = insertKind(insert)
  if (kind !== "caption" && kind !== "text") return insert
  const fontId = parseFontId(painted.text.fontFamily) ?? "geist"
  const upper = painted.text.textTransform === "uppercase"
  const placed = layoutTransform(insert, painted)
  return {
    ...insert,
    text: upper ? (insert.text ?? "").toLocaleUpperCase("pt-BR") : insert.text,
    x: placed.x,
    y: placed.y,
    fontSize: painted.text.fontSize,
    maxWidthPct: placed.maxWidth,
    fontFamily: fontId,
    rotation: placed.rotation,
    scale: placed.scale,
    style: {
      fontFamily: fontId,
      fontWeight: painted.text.fontWeight as FontWeight,
      uppercase: upper,
      color: painted.text.color,
      bgColor: painted.text.background.enabled ? painted.text.background.color : null,
      strokeWidth: painted.text.stroke.enabled ? painted.text.stroke.width : 0,
      strokeColor: painted.text.stroke.color,
      shadow: "none",
      opacity: opacityToUnit(painted.text.opacity),
      rotation: placed.rotation,
    },
  }
}

export function captionInsertForPlay(
  insert: CompositionInsert,
  painted: InsertStyle,
): CompositionInsert {
  if (insertKind(insert) !== "caption") return insert
  return stampPaintedLayout(insert, painted)
}

export function layoutCaptionInsertForPlay(
  insert: CompositionInsert,
  captionStyle: CaptionStyle,
  captionPreset: CaptionPreset,
  track: StyleLayer | null,
  project: StyleLayer,
): CompositionInsert {
  if (insertKind(insert) !== "caption") return insert
  const painted = resolveCaptionInsertStyle(
    insert,
    captionStyle,
    captionPreset,
    track,
    project,
  )
  return captionInsertForPlay(insert, painted)
}

export function layoutOverlayInsertForPlay(
  insert: CompositionInsert,
  captionStyle: CaptionStyle,
  captionPreset: CaptionPreset,
  track: StyleLayer | null,
  project: StyleLayer,
): CompositionInsert {
  if (insertKind(insert) === "caption") {
    return layoutCaptionInsertForPlay(insert, captionStyle, captionPreset, track, project)
  }
  if (
    insertKind(insert) === "text" &&
    usesFactoryPaint(insert, track, project) &&
    !offerStylePatch(insert.styleRef?.presetId)
  ) {
    const stamped = stampPaintedLayout(insert, resolveStyle(insert, track, project))
    // A rotação gravada é o extra do usuário. O carimbo não pode substituí-la
    // pelo ângulo visual, senão a inclinação do preset soma duas vezes.
    return {
      ...stamped,
      ...(typeof insert.rotation === "number" ? { rotation: insert.rotation } : { rotation: undefined }),
      ...(typeof insert.scale === "number" ? { scale: insert.scale } : {}),
    }
  }
  return insert
}

export function applyCaptionStylePatchToRefs(
  inserts: CompositionInsert[],
  patch: Partial<CaptionStyle>,
): CompositionInsert[] {
  const updates: Array<[string, unknown]> = []
  if (typeof patch.x === "number") updates.push(["text.x", patch.x])
  if (typeof patch.y === "number") updates.push(["text.y", patch.y])
  if (typeof patch.fontSize === "number") updates.push(["text.fontSize", patch.fontSize])
  if (typeof patch.maxWidthPct === "number") updates.push(["text.maxWidth", patch.maxWidthPct])
  if (typeof patch.fontFamily === "string") updates.push(["text.fontFamily", patch.fontFamily])
  if (typeof patch.fontWeight === "number") updates.push(["text.fontWeight", patch.fontWeight])
  if (typeof patch.color === "string") updates.push(["text.color", patch.color])
  if (typeof patch.highlightColor === "string") updates.push(["text.highlight.color", patch.highlightColor])
  if (typeof patch.bgColor === "string") updates.push(["text.background.color", patch.bgColor])
  if (typeof patch.strokeColor === "string") updates.push(["text.stroke.color", patch.strokeColor])
  if (typeof patch.strokeWidth === "number") updates.push(["text.stroke.width", patch.strokeWidth])
  if (typeof patch.rotation === "number") updates.push(["text.rotation", patch.rotation])
  if (updates.length === 0) return inserts

  return inserts.map((insert) => {
    if (insertKind(insert) !== "caption" || insert.captionOwnStyle) return insert
    const presetId = insert.styleRef?.presetId
    if (!presetId || presetId === LEGADO_PRESET_ID) return insert
    let ref = insert.styleRef
    if (!ref) return insert
    for (const [path, value] of updates) {
      ref = patchStyleRef(ref, path, value)
    }
    return { ...insert, styleRef: ref }
  })
}
