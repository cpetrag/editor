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

export type InsertsTabBadge = "pending" | "editing" | null

/**
 * Inserts já aplicados continuam no contador. "pending" é só texto novo
 * ainda não aplicado. Reeditar um texto existente vira "editing".
 * Legenda em edição não entra nesta aba.
 */
export function insertsTabSummary(
  inserts: readonly CompositionInsert[],
  editing: { id: string; created: boolean } | null,
): { applied: number; badge: InsertsTabBadge } {
  const visible = inserts.filter((insert) => insertKind(insert) !== "caption")
  const target = editing
    ? visible.find((insert) => insert.id === editing.id && insertKind(insert) === "text")
    : undefined
  if (!target || !editing) return { applied: visible.length, badge: null }
  if (editing.created) return { applied: visible.length - 1, badge: "pending" }
  return { applied: visible.length, badge: "editing" }
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
  const shared = captions.filter((insert) => !insert.captionOwnStyle)
  const pool = shared.length > 0 ? shared : captions
  const selected = pool.find((insert) => insert.id === selectedId)
  return selected ?? pool[0] ?? null
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
    insertKind(insert) === "caption" && !insert.captionOwnStyle
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
    if (insert.captionOwnStyle && insert.id !== host.id) return insert
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

export function captionExceptionIds(inserts: readonly CompositionInsert[]): string[] {
  return inserts.filter((insert) => insertKind(insert) === "caption" && insert.captionOwnStyle).map((insert) => insert.id)
}

export function isolateCaptionStyle(inserts: CompositionInsert[], id: string): CompositionInsert[] {
  return inserts.map((insert) =>
    insert.id === id && insertKind(insert) === "caption" ? { ...insert, captionOwnStyle: true } : insert,
  )
}

export function releaseCaptionStyle(inserts: CompositionInsert[], id: string): CompositionInsert[] {
  const shared = inserts.find((insert) => insertKind(insert) === "caption" && !insert.captionOwnStyle && insert.id !== id)
  return inserts.map((insert) => {
    if (insert.id !== id || insertKind(insert) !== "caption") return insert
    if (!shared) return { ...insert, captionOwnStyle: undefined }
    return {
      ...insert,
      captionOwnStyle: undefined,
      styleRef: shared.styleRef,
      transform: shared.transform,
      x: shared.x,
      y: shared.y,
      rotation: shared.rotation,
      maxWidthPct: shared.maxWidthPct,
      scale: shared.scale,
    }
  })
}

export function clearCaptionExceptions(inserts: CompositionInsert[]): CompositionInsert[] {
  const shared = inserts.find((insert) => insertKind(insert) === "caption" && !insert.captionOwnStyle)
  return inserts.map((insert) => {
    if (insertKind(insert) !== "caption" || !insert.captionOwnStyle) return insert
    if (!shared) return { ...insert, captionOwnStyle: undefined }
    return {
      ...insert,
      captionOwnStyle: undefined,
      styleRef: shared.styleRef,
      transform: shared.transform,
      x: shared.x,
      y: shared.y,
      rotation: shared.rotation,
      maxWidthPct: shared.maxWidthPct,
      scale: shared.scale,
    }
  })
}

export function applyOwnCaptionStyleToAll(inserts: CompositionInsert[], id: string): CompositionInsert[] {
  const host = inserts.find((insert) => insert.id === id && insertKind(insert) === "caption")
  if (!host) return inserts
  const shared = { ...host, captionOwnStyle: undefined }
  return stampCaptionVisual(
    inserts.map((insert) =>
      insertKind(insert) === "caption" ? { ...insert, captionOwnStyle: undefined } : insert,
    ),
    shared,
  )
}
