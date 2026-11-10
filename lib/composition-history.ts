import type { CaptionStyle, CompositionInsert, StyleRef, TrackId, TrackStyle } from "./composition.ts"
import type { ProductData } from "./content/runs.ts"
import type { ContentNiche } from "./content/presets.ts"
import type { BrandKitId } from "./brand/kits.ts"
import type { SourceTransform } from "./source-transform.ts"
import type { SourceTrim } from "./source-trim.ts"
import type { SourceCut } from "./source-segments.ts"
import type { CompositionAudio } from "./audio/types.ts"
import type { SourcePlayback } from "./video/playback.ts"

export const HISTORY_LIMIT = 50

export interface HistorySnapshot {
  inserts: CompositionInsert[]
  captionStyle: CaptionStyle
  tracks?: Partial<Record<TrackId, TrackStyle>>
  styleRef?: StyleRef
  sourceTransform?: SourceTransform
  sourceCuts?: SourceCut[]
  sourceTrim?: SourceTrim
  sourcePlayback?: SourcePlayback
  watermarkEnabled?: boolean
  retention?: { ganchoEnd: number; ctaStart: number }
  productData?: ProductData
  niche?: ContentNiche
  brandKitId?: BrandKitId
  audio?: CompositionAudio
}

export interface InsertHistory {
  past: HistorySnapshot[]
  future: HistorySnapshot[]
}

export interface InsertGesture {
  active: boolean
  baseline: HistorySnapshot | null
}

export function emptyHistory(): InsertHistory {
  return { past: [], future: [] }
}

export function emptyGesture(): InsertGesture {
  return { active: false, baseline: null }
}

export function cloneSnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as HistorySnapshot
}

export function snapshotsEqual(a: HistorySnapshot, b: HistorySnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function canUndo(history: InsertHistory): boolean {
  return history.past.length > 0
}

export function canRedo(history: InsertHistory): boolean {
  return history.future.length > 0
}

export function pushPast(
  history: InsertHistory,
  before: HistorySnapshot,
  after: HistorySnapshot,
): InsertHistory {
  if (snapshotsEqual(before, after)) return history
  const past = [...history.past, cloneSnapshot(before)]
  while (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] }
}

export function undo(
  history: InsertHistory,
  present: HistorySnapshot,
): { history: InsertHistory; present: HistorySnapshot } {
  if (history.past.length === 0) {
    return { history, present }
  }
  const past = history.past.slice(0, -1)
  const snapshot = history.past[history.past.length - 1]
  if (!snapshot) return { history, present }
  return {
    history: {
      past,
      future: [...history.future, cloneSnapshot(present)],
    },
    present: cloneSnapshot(snapshot),
  }
}

export function redo(
  history: InsertHistory,
  present: HistorySnapshot,
): { history: InsertHistory; present: HistorySnapshot } {
  if (history.future.length === 0) {
    return { history, present }
  }
  const future = history.future.slice(0, -1)
  const snapshot = history.future[history.future.length - 1]
  if (!snapshot) return { history, present }
  return {
    history: {
      past: [...history.past, cloneSnapshot(present)],
      future,
    },
    present: cloneSnapshot(snapshot),
  }
}

export function beginInsertGesture(
  present: HistorySnapshot,
  current?: InsertGesture,
): InsertGesture {
  if (current?.active) return current
  return { active: true, baseline: cloneSnapshot(present) }
}

export function endInsertGesture(
  history: InsertHistory,
  gesture: InsertGesture,
  present: HistorySnapshot,
): { history: InsertHistory; gesture: InsertGesture } {
  if (!gesture.active || !gesture.baseline) {
    return { history, gesture: emptyGesture() }
  }
  return {
    history: pushPast(history, gesture.baseline, present),
    gesture: emptyGesture(),
  }
}

export function commitDiscrete(
  history: InsertHistory,
  gesture: InsertGesture,
  before: HistorySnapshot,
  after: HistorySnapshot,
): { history: InsertHistory; gesture: InsertGesture } {
  const closed = endInsertGesture(history, gesture, before)
  return {
    history: pushPast(closed.history, before, after),
    gesture: closed.gesture,
  }
}

export function historyShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): "undo" | "redo" | null {
  if (!event.ctrlKey && !event.metaKey) return null
  const key = event.key.toLowerCase()
  if (key === "y") return "redo"
  if (key !== "z") return null
  return event.shiftKey ? "redo" : "undo"
}
