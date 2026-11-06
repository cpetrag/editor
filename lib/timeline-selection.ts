import { insertKind, type CompositionInsert } from "./composition.ts"
import { timelineTrackFor, type TimelineTrackId } from "./timeline-layout.ts"

export const TIMELINE_FPS = 30
export const FRAME_SECONDS = 1 / TIMELINE_FPS
export const MARQUEE_DRAG_PX = 4
export const SNAP_GUIDE_PX = 8
/** Confirma antes de apagar quando a seleção passa deste tamanho. */
export const DELETE_CONFIRM_ABOVE = 10

const SELECTABLE_TRACKS = new Set<TimelineTrackId>(["captions", "texts", "elements"])

export type TimelineItem = {
  id: string
  start: number
  duration: number
  track: TimelineTrackId
  caption: boolean
}

export type SelectionPointer = {
  ids: string[]
  primaryId: string | null
}

export type PxRect = {
  left: number
  top: number
  right: number
  bottom: number
}

function roundFrame(value: number): number {
  return Math.round(value * TIMELINE_FPS) / TIMELINE_FPS
}

export function toTimelineItem(
  insert: Pick<CompositionInsert, "id" | "start" | "duration" | "kind" | "type">,
): TimelineItem | null {
  const track = timelineTrackFor(insert)
  if (!SELECTABLE_TRACKS.has(track)) return null
  return {
    id: insert.id,
    start: insert.start,
    duration: insert.duration,
    track,
    caption: insertKind(insert) === "caption",
  }
}

export function selectableItems(
  inserts: readonly Pick<CompositionInsert, "id" | "start" | "duration" | "kind" | "type">[],
): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const insert of inserts) {
    const item = toTimelineItem(insert)
    if (item) items.push(item)
  }
  return items
}

function byTime(a: TimelineItem, b: TimelineItem): number {
  return a.start - b.start || a.id.localeCompare(b.id)
}

export function nextClickSelection(
  current: SelectionPointer,
  clickedId: string,
  items: readonly TimelineItem[],
  modifiers: { additive: boolean; range: boolean },
): SelectionPointer {
  if (modifiers.range && current.primaryId) {
    const rangeIds = idsBetween(items, current.primaryId, clickedId)
    const ids = modifiers.additive ? union(current.ids, rangeIds) : rangeIds
    return { ids, primaryId: clickedId }
  }
  if (modifiers.additive) {
    const has = current.ids.includes(clickedId)
    const ids = has ? current.ids.filter((id) => id !== clickedId) : [...current.ids, clickedId]
    if (ids.length === 0) return { ids: [], primaryId: null }
    const primaryId = has
      ? current.primaryId === clickedId
        ? ids[ids.length - 1]!
        : current.primaryId
      : clickedId
    return { ids, primaryId }
  }
  return { ids: [clickedId], primaryId: clickedId }
}

function union(left: readonly string[], right: readonly string[]): string[] {
  const ids = [...left]
  for (const id of right) {
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** Itens da mesma faixa, do principal ao clicado, na ordem do tempo. */
export function idsBetween(
  items: readonly TimelineItem[],
  anchorId: string,
  clickedId: string,
): string[] {
  const anchor = items.find((item) => item.id === anchorId)
  const clicked = items.find((item) => item.id === clickedId)
  if (!clicked) return []
  if (!anchor || anchor.track !== clicked.track) return [clickedId]
  const trackItems = items.filter((item) => item.track === anchor.track).sort(byTime)
  const first = trackItems.findIndex((item) => item.id === anchorId)
  const second = trackItems.findIndex((item) => item.id === clickedId)
  if (first < 0 || second < 0) return [clickedId]
  const [from, to] = first < second ? [first, second] : [second, first]
  return trackItems.slice(from, to + 1).map((item) => item.id)
}

export function rectsIntersect(a: PxRect, b: PxRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

export function idsTouchingRect(
  rects: readonly { id: string; rect: PxRect }[],
  marquee: PxRect,
): string[] {
  return rects.filter((item) => rectsIntersect(item.rect, marquee)).map((item) => item.id)
}

export function marqueeSelection(
  current: SelectionPointer,
  hitIds: readonly string[],
  items: readonly TimelineItem[],
  additive: boolean,
): SelectionPointer {
  if (hitIds.length === 0) {
    return additive ? current : { ids: [], primaryId: null }
  }
  const ids = additive ? union(current.ids, hitIds) : [...hitIds]
  if (additive && current.primaryId && ids.includes(current.primaryId)) {
    return { ids, primaryId: current.primaryId }
  }
  const byId = new Map(items.map((item) => [item.id, item]))
  const primaryId = [...hitIds].sort((a, b) => {
    const left = byId.get(a)
    const right = byId.get(b)
    return (left?.start ?? 0) - (right?.start ?? 0) || a.localeCompare(b)
  }).at(-1) ?? hitIds[hitIds.length - 1]!
  return { ids, primaryId }
}

export function idsOnTrack(items: readonly TimelineItem[], track: TimelineTrackId): string[] {
  return items.filter((item) => item.track === track).sort(byTime).map((item) => item.id)
}

export function selectAllItems(
  items: readonly TimelineItem[],
  primaryId: string | null,
): SelectionPointer {
  const sorted = [...items].sort(byTime)
  const ids = sorted.map((item) => item.id)
  if (ids.length === 0) return { ids: [], primaryId: null }
  const primary = primaryId && ids.includes(primaryId) ? primaryId : ids[0]!
  return { ids, primaryId: primary }
}

function selectedOf(items: readonly TimelineItem[], selectedIds: readonly string[]): TimelineItem[] {
  const wanted = new Set(selectedIds)
  return items.filter((item) => wanted.has(item.id))
}

function clampDeltaToBounds(
  selected: readonly TimelineItem[],
  delta: number,
  videoDuration: number,
): number {
  if (selected.length === 0) return 0
  let minStart = Infinity
  let maxEnd = -Infinity
  for (const item of selected) {
    minStart = Math.min(minStart, item.start)
    maxEnd = Math.max(maxEnd, item.start + item.duration)
  }
  let next = delta
  if (minStart + next < 0) next = -minStart
  if (videoDuration > 0 && maxEnd + next > videoDuration) next = videoDuration - maxEnd
  return next
}

function captionsOverlap(
  start: number,
  end: number,
  otherStart: number,
  otherEnd: number,
): boolean {
  return start < otherEnd - 1e-4 && otherStart < end - 1e-4
}

function groupHitsCaption(
  selected: readonly TimelineItem[],
  obstacles: readonly TimelineItem[],
  delta: number,
): boolean {
  for (const item of selected) {
    if (!item.caption) continue
    const start = item.start + delta
    const end = start + item.duration
    for (const other of obstacles) {
      if (!other.caption) continue
      if (captionsOverlap(start, end, other.start, other.end)) return true
    }
  }
  return false
}

function forwardRoom(item: TimelineItem, other: TimelineItem): number | null {
  const end = item.start + item.duration
  if (other.start >= end - 1e-4) return other.start - end
  if (captionsOverlap(item.start, end, other.start, other.start + other.duration)) return 0
  return null
}

function backwardRoom(item: TimelineItem, other: TimelineItem): number | null {
  const otherEnd = other.start + other.duration
  if (otherEnd <= item.start + 1e-4) return otherEnd - item.start
  if (captionsOverlap(item.start, item.start + item.duration, other.start, otherEnd)) return 0
  return null
}

/**
 * O arraste é contínuo: a legenda para na borda da próxima, sem pular por cima.
 */
function limitCaptionDelta(
  selected: readonly TimelineItem[],
  obstacles: readonly TimelineItem[],
  desired: number,
): number {
  let minDelta = -Infinity
  let maxDelta = Infinity
  for (const item of selected) {
    if (!item.caption) continue
    for (const other of obstacles) {
      if (!other.caption) continue
      const forward = forwardRoom(item, other)
      if (forward !== null) maxDelta = Math.min(maxDelta, forward)
      const backward = backwardRoom(item, other)
      if (backward !== null) minDelta = Math.max(minDelta, backward)
    }
  }
  return Math.min(maxDelta, Math.max(minDelta, desired))
}

export function snapToleranceSeconds(trackWidthPx: number, videoDuration: number): number {
  if (!(trackWidthPx > 0) || !(videoDuration > 0)) return 0
  return (SNAP_GUIDE_PX * videoDuration) / trackWidthPx
}

export function snapTargetTimes(
  items: readonly Pick<TimelineItem, "id" | "start" | "duration">[],
  selectedIds: readonly string[],
  playhead: number,
): number[] {
  const selected = new Set(selectedIds)
  const targets = [playhead]
  for (const item of items) {
    if (selected.has(item.id)) continue
    targets.push(item.start, item.start + item.duration)
  }
  return targets
}

export type GroupMove = {
  delta: number
  guide: number | null
  starts: { id: string; start: number; duration: number }[]
}

export function moveTimelineGroup(input: {
  items: readonly TimelineItem[]
  selectedIds: readonly string[]
  delta: number
  videoDuration: number
  snapTolerance: number
  snapTargets: readonly number[]
}): GroupMove {
  const selected = selectedOf(input.items, input.selectedIds)
  const empty: GroupMove = { delta: 0, guide: null, starts: [] }
  if (selected.length === 0) return empty

  let delta = clampDeltaToBounds(selected, input.delta, input.videoDuration)
  let guide: number | null = null
  if (input.snapTolerance > 0) {
    const snapped = snapDelta(selected, delta, input.snapTargets, input.snapTolerance)
    if (snapped) {
      const bounded = clampDeltaToBounds(selected, snapped.delta, input.videoDuration)
      if (Math.abs(bounded - snapped.delta) < 1e-4) {
        delta = snapped.delta
        guide = snapped.guide
      }
    }
  }

  const obstacles = input.items.filter((item) => item.caption && !selected.some((picked) => picked.id === item.id))
  const limited = limitCaptionDelta(selected, obstacles, delta)
  if (Math.abs(limited - delta) > 1e-4) guide = null
  delta = limited

  return {
    delta,
    guide,
    starts: selected.map((item) => ({
      id: item.id,
      start: item.start + delta,
      duration: item.duration,
    })),
  }
}

function snapDelta(
  selected: readonly TimelineItem[],
  delta: number,
  targets: readonly number[],
  tolerance: number,
): { delta: number; guide: number } | null {
  let bestDist = tolerance
  let bestAdjust = 0
  let guide: number | null = null
  const edges: number[] = []
  for (const item of selected) {
    edges.push(item.start + delta, item.start + item.duration + delta)
  }
  for (const edge of edges) {
    for (const target of targets) {
      const dist = Math.abs(target - edge)
      if (dist < bestDist - 1e-9 || (guide === null && dist <= tolerance)) {
        bestDist = dist
        bestAdjust = target - edge
        guide = target
      }
    }
  }
  if (guide === null) return null
  return { delta: delta + bestAdjust, guide }
}

/**
 * Desloca as cópias para começarem logo depois do fim do último selecionado.
 * `null` quando não cabe sem sobrepor legenda.
 */
export function duplicateGroupDelta(
  items: readonly TimelineItem[],
  selectedIds: readonly string[],
  videoDuration: number,
): number | null {
  const selected = selectedOf(items, selectedIds)
  if (selected.length === 0 || !(videoDuration > 0)) return null
  const minStart = Math.min(...selected.map((item) => item.start))
  const maxEnd = Math.max(...selected.map((item) => item.start + item.duration))
  const desired = clampDeltaToBounds(selected, maxEnd - minStart, videoDuration)
  if (!(desired > 1e-4)) return null
  const captions = items.filter((item) => item.caption)
  if (!groupHitsCaption(selected, captions, desired)) return desired
  const sign = 1
  let cursor = roundFrame(desired)
  if (cursor > desired) cursor = roundFrame(cursor - FRAME_SECONDS)
  while (cursor > 1e-6) {
    if (!groupHitsCaption(selected, captions, cursor)) return cursor
    cursor = roundFrame(cursor - sign * FRAME_SECONDS)
  }
  return null
}

export function describeSelection(counts: {
  captions: number
  texts: number
  elements: number
}): string {
  const total = counts.captions + counts.texts + counts.elements
  const head = total === 1 ? "1 item" : `${total} itens`
  const parts: string[] = []
  if (counts.captions === 1) parts.push("1 legenda")
  else if (counts.captions > 1) parts.push(`${counts.captions} legendas`)
  if (counts.texts === 1) parts.push("1 texto")
  else if (counts.texts > 1) parts.push(`${counts.texts} textos`)
  if (counts.elements === 1) parts.push("1 elemento")
  else if (counts.elements > 1) parts.push(`${counts.elements} elementos`)
  return parts.length > 0 ? `${head}: ${parts.join(", ")}` : head
}

export function selectionKindCounts(items: readonly TimelineItem[], ids: readonly string[]): {
  captions: number
  texts: number
  elements: number
} {
  const wanted = new Set(ids)
  const counts = { captions: 0, texts: 0, elements: 0 }
  for (const item of items) {
    if (!wanted.has(item.id)) continue
    if (item.track === "captions") counts.captions += 1
    else if (item.track === "texts") counts.texts += 1
    else if (item.track === "elements") counts.elements += 1
  }
  return counts
}
