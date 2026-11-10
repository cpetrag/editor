import { insertKind, type CompositionInsert } from "./composition.ts"
import { stackLanes } from "./insert-ops.ts"
import type { Insert } from "./inserts.ts"

export type TimelineTrackId = "segments" | "captions" | "texts" | "audio" | "elements"

export const TIMELINE_TRACK_LABELS: Record<TimelineTrackId, string> = {
  segments: "Trechos",
  captions: "Legendas",
  texts: "Textos",
  audio: "Áudio",
  elements: "Elementos",
}

const TRACK_ORDER: TimelineTrackId[] = ["segments", "captions", "texts", "elements"]

export const TIMELINE_LANE_HEIGHT = 20
export const TIMELINE_CLIP_HEIGHT = 16
export const TIMELINE_SEGMENT_TRACK_HEIGHT = 24
export const TIMELINE_AUDIO_LANE_HEIGHT = 22
export const TIMELINE_TRACK_GAP = 4

export type TimelineTrackLayout = {
  id: TimelineTrackId
  label: string
  top: number
  height: number
}

export type TimelineLayout = {
  tracks: TimelineTrackLayout[]
  /** Topo de cada clipe (px) dentro da área das trilhas. */
  clipTops: Map<string, number>
  height: number
}

export function timelineTrackFor(insert: Pick<CompositionInsert, "kind" | "type">): TimelineTrackId {
  const kind = insertKind(insert)
  if (kind === "caption") return "captions"
  if (kind === "text") return "texts"
  return "elements"
}

/** Cada trilha empilha os próprios clipes. Texto e elemento vazios não ocupam faixa. */
export function layoutTimelineTracks(
  inserts: readonly Insert[],
  audioTrackIds: readonly string[] = [],
): TimelineLayout {
  const byTrack = new Map<TimelineTrackId, Insert[]>()
  for (const insert of inserts) {
    const track = timelineTrackFor(insert)
    const list = byTrack.get(track) ?? []
    list.push(insert)
    byTrack.set(track, list)
  }

  const tracks: TimelineTrackLayout[] = []
  const clipTops = new Map<string, number>()
  let top = 0
  const pushAudio = () => {
    if (audioTrackIds.length === 0 || tracks.some((track) => track.id === "audio")) return
    const audioHeight = audioTrackIds.length * TIMELINE_AUDIO_LANE_HEIGHT
    audioTrackIds.forEach((audioId, index) => {
      clipTops.set(audioId, top + index * TIMELINE_AUDIO_LANE_HEIGHT)
    })
    tracks.push({ id: "audio", label: TIMELINE_TRACK_LABELS.audio, top, height: audioHeight })
    top += audioHeight + TIMELINE_TRACK_GAP
  }
  for (const id of TRACK_ORDER) {
    if (id === "segments") {
      tracks.push({ id, label: TIMELINE_TRACK_LABELS[id], top, height: TIMELINE_SEGMENT_TRACK_HEIGHT })
      top += TIMELINE_SEGMENT_TRACK_HEIGHT + TIMELINE_TRACK_GAP
      continue
    }
    const members = byTrack.get(id) ?? []
    const lanes = stackLanes(members)
    // Legendas ficam na faixa delas. Textos e elementos só abrem outra faixa se um clipe sobrepõe outro.
    let laneCount = members.length === 0 ? (id === "captions" ? 1 : 0) : 1
    for (const lane of lanes.values()) laneCount = Math.max(laneCount, lane + 1)
    const height = laneCount * TIMELINE_LANE_HEIGHT
    if (height === 0) {
      if (id === "texts") pushAudio()
      continue
    }
    const clipOffset = (TIMELINE_LANE_HEIGHT - TIMELINE_CLIP_HEIGHT) / 2
    for (const [insertId, lane] of lanes) {
      clipTops.set(insertId, top + lane * TIMELINE_LANE_HEIGHT + clipOffset)
    }
    tracks.push({ id, label: TIMELINE_TRACK_LABELS[id], top, height })
    top += height + TIMELINE_TRACK_GAP
    if (id === "texts") pushAudio()
  }
  return { tracks, clipTops, height: Math.max(0, top - TIMELINE_TRACK_GAP) }
}

export const TIMELINE_ZOOM_MIN = 1
export const TIMELINE_ZOOM_MAX = 16

export function clampTimelineZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return TIMELINE_ZOOM_MIN
  return Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, zoom))
}

export function zoomFromWheel(zoom: number, deltaY: number): number {
  return clampTimelineZoom(zoom * Math.exp(-deltaY * 0.002))
}

/**
 * scrollLeft que mantém o mesmo instante sob o ponteiro depois do zoom.
 * `pointerX` é relativo à borda esquerda da área visível.
 */
export function scrollLeftForZoom(input: {
  zoom: number
  nextZoom: number
  scrollLeft: number
  pointerX: number
  viewportWidth: number
}): number {
  const { zoom, nextZoom, scrollLeft, pointerX, viewportWidth } = input
  if (!(viewportWidth > 0)) return 0
  const ratio = (scrollLeft + pointerX) / (viewportWidth * zoom)
  const next = ratio * viewportWidth * nextZoom - pointerX
  const maxScroll = viewportWidth * nextZoom - viewportWidth
  return Math.min(Math.max(0, next), Math.max(0, maxScroll))
}

/** scrollLeft para o playhead não sair da área visível enquanto toca. */
export function scrollLeftToReveal(input: {
  x: number
  scrollLeft: number
  viewportWidth: number
  margin?: number
}): number {
  const { x, scrollLeft, viewportWidth } = input
  const margin = input.margin ?? 24
  if (x < scrollLeft + margin) return Math.max(0, x - margin)
  if (x > scrollLeft + viewportWidth - margin) return x - viewportWidth + margin
  return scrollLeft
}

/** Abaixo disso o nome do clipe não cabe e fica só no título (hover). */
export const CLIP_LABEL_MIN_WIDTH = 34

export function clipShowsLabel(widthPx: number): boolean {
  return widthPx >= CLIP_LABEL_MIN_WIDTH
}
