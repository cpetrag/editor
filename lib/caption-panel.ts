import { insertKind, mergeCaptionStylePatch, type CaptionStyle, type CompositionInsert } from "./composition.ts"
import { applyCaptionStylePatchToRefs } from "./compose/caption-layout.ts"
import {
  applyUserTransformPatch,
  defaultTransformForInsert,
  type InsertTransform,
} from "./insert-transform.ts"

export const CAPTION_TEXT_PLACEHOLDER = "Clique uma legenda na timeline."

export function nonCaptionInserts(inserts: CompositionInsert[]): CompositionInsert[] {
  return inserts.filter((insert) => insertKind(insert) !== "caption")
}

export function countCaptionInserts(inserts: CompositionInsert[]): number {
  let count = 0
  for (const insert of inserts) {
    if (insertKind(insert) === "caption") count += 1
  }
  return count
}

export function captionStyleHost(
  inserts: CompositionInsert[],
  selectedId: string | null,
): CompositionInsert | null {
  const captions = inserts.filter((insert) => insertKind(insert) === "caption")
  if (captions.length === 0) return null
  const selected = captions.find((insert) => insert.id === selectedId)
  return selected ?? captions[0] ?? null
}

export type CaptionTextEditorState =
  | { mode: "placeholder" }
  | { mode: "editing"; insert: CompositionInsert }

export function captionTextEditorState(
  inserts: CompositionInsert[],
  selectedId: string | null,
): CaptionTextEditorState {
  const selected = inserts.find((insert) => insert.id === selectedId)
  if (selected && insertKind(selected) === "caption") {
    return { mode: "editing", insert: selected }
  }
  return { mode: "placeholder" }
}

export function captionStylePatchFromTransform(
  patch: Partial<Pick<InsertTransform, "x" | "y" | "rotation" | "maxWidth">>,
): Partial<CaptionStyle> {
  const look: Partial<CaptionStyle> = {}
  if (typeof patch.x === "number") look.x = patch.x
  if (typeof patch.y === "number") look.y = patch.y
  if (typeof patch.rotation === "number") look.rotation = patch.rotation
  if (typeof patch.maxWidth === "number") look.maxWidthPct = patch.maxWidth
  return look
}

export function applyCaptionTransformToAll(
  inserts: CompositionInsert[],
  patch: Partial<Pick<InsertTransform, "x" | "y" | "scale" | "rotation" | "maxWidth">>,
): CompositionInsert[] {
  return inserts.map((insert) =>
    insertKind(insert) === "caption"
      ? applyUserTransformPatch(insert, patch, defaultTransformForInsert(insert))
      : insert,
  )
}

export function stampCaptionVisual(
  inserts: CompositionInsert[],
  host: CompositionInsert,
): CompositionInsert[] {
  if (insertKind(host) !== "caption") return inserts
  return inserts.map((insert) => {
    if (insertKind(insert) !== "caption") return insert
    if (insert.id === host.id) return host
    return {
      ...insert,
      styleRef: host.styleRef,
      transform: host.transform,
      x: host.x,
      y: host.y,
      rotation: host.rotation,
      maxWidthPct: host.maxWidthPct,
      scale: host.scale,
    }
  })
}

export function transformPatchFromCaptionStyle(
  patch: Partial<CaptionStyle>,
): Partial<Pick<InsertTransform, "x" | "y" | "rotation" | "maxWidth">> | null {
  const next: Partial<Pick<InsertTransform, "x" | "y" | "rotation" | "maxWidth">> = {}
  if (typeof patch.x === "number") next.x = patch.x
  if (typeof patch.y === "number") next.y = patch.y
  if (typeof patch.rotation === "number") next.rotation = patch.rotation
  if (typeof patch.maxWidthPct === "number") next.maxWidth = patch.maxWidthPct
  return Object.keys(next).length > 0 ? next : null
}

export function applySharedCaptionVisual(
  inserts: CompositionInsert[],
  captionStyle: CaptionStyle,
  patch: Partial<CaptionStyle>,
  hostId: string | null = null,
): { inserts: CompositionInsert[]; captionStyle: CaptionStyle } {
  const nextStyle = mergeCaptionStylePatch(captionStyle, patch)
  let nextInserts = applyCaptionStylePatchToRefs(inserts, patch)
  const transformPatch = transformPatchFromCaptionStyle(patch)
  if (transformPatch) {
    const host = captionStyleHost(nextInserts, hostId)
    if (host) {
      const moved = applyUserTransformPatch(
        host,
        transformPatch,
        defaultTransformForInsert(host),
      )
      nextInserts = stampCaptionVisual(nextInserts, moved)
    } else {
      nextInserts = applyCaptionTransformToAll(nextInserts, transformPatch)
    }
  }
  return { inserts: nextInserts, captionStyle: nextStyle }
}
