"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Scissors } from "lucide-react"

import { AudioWaveform } from "@/components/audio-waveform"
import { TimelineClipBar } from "@/components/timeline-clip"
import { slicePeaks } from "@/lib/audio/peaks"
import { moveAudioTrack, trackOutputRange, trimAudioInEdge, trimAudioOutEdge, usableLength } from "@/lib/audio/range"
import type { VideoSegment } from "@/lib/video/timeline"
import type { AudioTrack } from "@/lib/audio/types"
import { formatTime, type Insert } from "@/lib/inserts"
import { retentionZones, type RetentionCuts } from "@/lib/insert-ops"
import { sourceZoomPercent } from "@/lib/source-transform"
import type { SourceCut, listSourceSegments } from "@/lib/source-segments"
import { clientXToTime, type TimelineHandle } from "@/lib/timeline-clip"
import {
  TIMELINE_AUDIO_LANE_HEIGHT,
  TIMELINE_CLIP_HEIGHT,
  TIMELINE_ZOOM_MIN,
  clipShowsLabel,
  layoutTimelineTracks,
  scrollLeftForZoom,
  scrollLeftToReveal,
  zoomFromWheel,
} from "@/lib/timeline-layout"
import {
  MARQUEE_DRAG_PX,
  idsTouchingRect,
  marqueeSelection,
  selectableItems,
  snapToleranceSeconds,
  type PxRect,
} from "@/lib/timeline-selection"
import type { ClipMotionMarks } from "@/lib/motion/select"
import { cn } from "@/lib/utils"

type SourceSegment = ReturnType<typeof listSourceSegments>[number]

const TICKS_HEIGHT = 16
const RETENTION_STRIP_HEIGHT = 12
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120]
const MIN_TICK_SPACING_PX = 56

function tickStepFor(pxPerSecond: number): number {
  return TICK_STEPS.find((step) => step * pxPerSecond >= MIN_TICK_SPACING_PX) ?? 300
}

export interface EditorTimelineProps {
  totalDuration: number
  currentTime: number
  playing: boolean
  inserts: Insert[]
  selectedInsertId: string | null
  pendingInsertId?: string | null
  exporting: boolean
  showRetention: boolean
  retentionCuts?: RetentionCuts | null
  segments: SourceSegment[]
  playbackSegments?: VideoSegment[]
  activeSegmentIndex: number
  sourceCuts?: SourceCut[]
  onRemoveSourceCut?: (index: number) => void
  trimWindow: { start: number; end: number }
  hasTrim: boolean
  canDragTrim: boolean
  /** Área com a largura total (zoom incluso); os arrastes do painel medem por ela. */
  contentRef: RefObject<HTMLDivElement | null>
  zoom: number
  onZoomChange: (zoom: number) => void
  onSeek: (time: number) => void
  onScrubStart?: () => void
  onTrimPointerDown: (event: React.PointerEvent, edge: "in" | "out") => void
  onClipPointerDown: (event: React.PointerEvent, insert: Insert, handle: TimelineHandle) => void
  selectedIds?: readonly string[]
  snapGuideTime?: number | null
  audioTracks?: readonly AudioTrack[]
  audioPeaks?: Record<string, number[]>
  sourcePeaks?: number[]
  sourceAudioDim?: boolean
  selectedAudioId?: string | null
  onSelectAudio?: (id: string) => void
  onAudioEdit?: (id: string, patch: Partial<AudioTrack>, phase: "start" | "move" | "end") => void
  onChangeSelection?: (ids: string[], primaryId: string | null) => void
  onSelectionCommand?: (
    command: "duplicate" | "delete" | "align" | "track",
    ids: string[],
    primaryId: string,
  ) => void
  motionById?: Record<string, ClipMotionMarks>
  onEmphasisMove?: (insertId: string, index: number, atFrame: number) => void
  onEmphasisGesture?: (phase: "start" | "end") => void
}

export function EditorTimeline({
  totalDuration,
  currentTime,
  playing,
  inserts,
  selectedInsertId,
  pendingInsertId = null,
  exporting,
  showRetention,
  retentionCuts = null,
  segments,
  playbackSegments,
  activeSegmentIndex,
  sourceCuts,
  onRemoveSourceCut,
  trimWindow,
  hasTrim,
  canDragTrim,
  contentRef,
  zoom,
  onZoomChange,
  onSeek,
  onScrubStart,
  onTrimPointerDown,
  onClipPointerDown,
  selectedIds,
  snapGuideTime = null,
  audioTracks = [],
  audioPeaks = {},
  sourcePeaks = [],
  sourceAudioDim = false,
  selectedAudioId = null,
  onSelectAudio,
  onAudioEdit,
  onChangeSelection,
  onSelectionCommand,
  motionById,
  onEmphasisMove,
  onEmphasisGesture,
}: EditorTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const marqueeRef = useRef<{
    originX: number
    originY: number
    additive: boolean
  } | null>(null)
  const [marquee, setMarquee] = useState<PxRect | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    ids: string[]
    primaryId: string
  } | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const [viewportWidth, setViewportWidth] = useState(0)

  const audioDragRef = useRef<{
    handle: "move" | "in" | "out"
    origin: number
    track: AudioTrack
  } | null>(null)
  const layout = useMemo(
    () => layoutTimelineTracks(inserts, audioTracks.map((track) => track.id)),
    [audioTracks, inserts],
  )
  const zones = useMemo(
    () => (showRetention && totalDuration > 0 ? retentionZones(totalDuration, retentionCuts) : []),
    [retentionCuts, showRetention, totalDuration],
  )
  const rulerHeight = TICKS_HEIGHT + (zones.length > 0 ? RETENTION_STRIP_HEIGHT : 0)
  const contentWidth = viewportWidth * zoom
  const pxPerSecond = totalDuration > 0 ? contentWidth / totalDuration : 0
  const tickStep = tickStepFor(pxPerSecond)
  const ticks = useMemo(() => {
    if (!(totalDuration > 0) || !(pxPerSecond > 0)) return []
    const list: number[] = []
    for (let time = 0; time <= totalDuration + 1e-6; time += tickStep) list.push(time)
    return list
  }, [pxPerSecond, tickStep, totalDuration])
  const pct = (time: number) => (totalDuration > 0 ? (time / totalDuration) * 100 : 0)
  const progress = pct(currentTime)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewportWidth(entry.contentRect.width)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  // React registra `wheel` como passivo; sem `passive: false` o Ctrl+scroll daria zoom na página.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    function onWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey) || !viewport) return
      event.preventDefault()
      const current = zoomRef.current
      const next = zoomFromWheel(current, event.deltaY)
      if (next === current) return
      const rect = viewport.getBoundingClientRect()
      const scrollLeft = scrollLeftForZoom({
        zoom: current,
        nextZoom: next,
        scrollLeft: viewport.scrollLeft,
        pointerX: event.clientX - rect.left,
        viewportWidth: rect.width,
      })
      onZoomChange(next)
      requestAnimationFrame(() => {
        viewport.scrollLeft = scrollLeft
      })
    }
    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [onZoomChange])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !playing || zoom <= TIMELINE_ZOOM_MIN) return
    const x = (progress / 100) * viewport.scrollWidth
    const next = scrollLeftToReveal({ x, scrollLeft: viewport.scrollLeft, viewportWidth: viewport.clientWidth })
    if (next !== viewport.scrollLeft) viewport.scrollLeft = next
  }, [playing, progress, zoom])

  function timeAtClientX(clientX: number): number {
    const content = contentRef.current
    if (!content) return 0
    return clientXToTime(clientX, content.getBoundingClientRect(), totalDuration)
  }

  function contentPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const content = contentRef.current
    if (!content) return null
    const rect = content.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function clipRects(): { id: string; rect: PxRect }[] {
    const width = contentWidth
    if (!(totalDuration > 0) || !(width > 0)) return []
    const rects: { id: string; rect: PxRect }[] = []
    for (const insert of inserts) {
      if (!selectableItems([insert]).length) continue
      const top = rulerHeight + 4 + (layout.clipTops.get(insert.id) ?? 0)
      const left = (insert.start / totalDuration) * width
      const clipWidth = Math.max((insert.duration / totalDuration) * width, 6)
      rects.push({
        id: insert.id,
        rect: { left, top, right: left + clipWidth, bottom: top + TIMELINE_CLIP_HEIGHT },
      })
    }
    return rects
  }

  function onScrubPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || exporting || !(totalDuration > 0)) return
    const point = contentPoint(event.clientX, event.clientY)
    if (!point) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    setContextMenu(null)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ponteiro já solto (ex.: toque cancelado): o gesto segue só com os eventos que chegarem.
    }
    if (point.y <= rulerHeight) {
      scrubbingRef.current = true
      marqueeRef.current = null
      onScrubStart?.()
      onSeek(timeAtClientX(event.clientX))
      return
    }
    scrubbingRef.current = false
    marqueeRef.current = {
      originX: event.clientX,
      originY: event.clientY,
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
    }
    setMarquee(null)
    onScrubStart?.()
  }

  function onScrubPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (scrubbingRef.current) {
      onSeek(timeAtClientX(event.clientX))
      return
    }
    const drag = marqueeRef.current
    if (!drag) return
    const moved = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY)
    if (moved < MARQUEE_DRAG_PX) return
    const start = contentPoint(drag.originX, drag.originY)
    const current = contentPoint(event.clientX, event.clientY)
    if (!start || !current) return
    setMarquee({
      left: Math.min(start.x, current.x),
      top: Math.min(start.y, current.y),
      right: Math.max(start.x, current.x),
      bottom: Math.max(start.y, current.y),
    })
  }

  function endScrub(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (scrubbingRef.current) {
      scrubbingRef.current = false
      return
    }
    const drag = marqueeRef.current
    marqueeRef.current = null
    if (!drag) return
    const moved = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY)
    setMarquee(null)
    if (moved < MARQUEE_DRAG_PX) {
      onChangeSelection?.([], null)
      onSeek(timeAtClientX(event.clientX))
      return
    }
    const start = contentPoint(drag.originX, drag.originY)
    const current = contentPoint(event.clientX, event.clientY)
    if (!start || !current || !onChangeSelection) return
    const hit = idsTouchingRect(clipRects(), {
      left: Math.min(start.x, current.x),
      top: Math.min(start.y, current.y),
      right: Math.max(start.x, current.x),
      bottom: Math.max(start.y, current.y),
    })
    const next = marqueeSelection(
      { ids: [...(selectedIds ?? [])], primaryId: selectedInsertId },
      hit,
      selectableItems(inserts),
      drag.additive,
    )
    onChangeSelection(next.ids, next.primaryId)
  }

  function openClipMenu(event: React.MouseEvent, insert: Insert) {
    const ids = selectedIds ?? []
    const already = ids.includes(insert.id)
    const menuIds = already ? [...ids] : [insert.id]
    if (!already) onChangeSelection?.(menuIds, insert.id)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      ids: menuIds,
      primaryId: insert.id,
    })
  }

  useEffect(() => {
    if (!contextMenu) return
    function close() {
      setContextMenu(null)
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest("[data-timeline-menu]")) return
      close()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [contextMenu])

  const segmentsTrack = layout.tracks.find((track) => track.id === "segments")
  const audioKindColor: Record<AudioTrack["kind"], string> = {
    music: "#34d399",
    voice: "#fbbf24",
    sfx: "#c4b5fd",
  }
  function snapAudioTime(time: number): number {
    const tolerance = snapToleranceSeconds(contentWidth, totalDuration)
    if (!(tolerance > 0)) return time
    const targets = [currentTime, 0, totalDuration]
    for (const segment of segments) targets.push(segment.start, segment.end)
    if (retentionCuts) targets.push(retentionCuts.ganchoEnd, retentionCuts.ctaStart)
    let best = time
    let bestDist = tolerance
    for (const target of targets) {
      const dist = Math.abs(target - time)
      if (dist <= bestDist) {
        best = target
        bestDist = dist
      }
    }
    return best
  }
  function onAudioPointerDown(event: React.PointerEvent, track: AudioTrack, handle: "move" | "in" | "out") {
    if (event.button !== 0 || exporting) return
    event.preventDefault()
    event.stopPropagation()
    onSelectAudio?.(track.id)
    const rect = contentRef.current?.getBoundingClientRect()
    if (!rect) return
    audioDragRef.current = {
      handle,
      origin: clientXToTime(event.clientX, rect, totalDuration),
      track,
    }
    onAudioEdit?.(track.id, {}, "start")
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onAudioPointerMove(event: React.PointerEvent) {
    const drag = audioDragRef.current
    const rect = contentRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const time = snapAudioTime(clientXToTime(event.clientX, rect, totalDuration))
    const next =
      drag.handle === "in"
        ? trimAudioInEdge(drag.track, time, totalDuration)
        : drag.handle === "out"
          ? trimAudioOutEdge(drag.track, time, totalDuration)
          : moveAudioTrack(drag.track, drag.track.start + (time - drag.origin), totalDuration)
    onAudioEdit?.(drag.track.id, { start: next.start, trimIn: next.trimIn, trimOut: next.trimOut }, "move")
  }
  function onAudioPointerUp() {
    const drag = audioDragRef.current
    if (!drag) return
    audioDragRef.current = null
    onAudioEdit?.(drag.track.id, {}, "end")
  }
  const tracksHeight = layout.height
  const selectedIdList = selectedIds ?? (selectedInsertId ? [selectedInsertId] : [])
  const singleSelection = selectedIdList.length === 1

  return (
    <div data-editor-timeline className="flex max-h-[34vh] min-h-0 items-start overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-background/40">
      {/* nomes das trilhas */}
      <div className="sticky left-0 z-30 w-20 shrink-0 border-r border-border bg-card" aria-hidden>
        <div style={{ height: rulerHeight }} className="border-b border-border" />
        <div className="relative" style={{ height: tracksHeight + 8 }}>
          {layout.tracks.map((track) => (
            <span
              key={track.id}
              className="absolute inset-x-0 flex items-center px-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ top: track.top + 4, height: track.height }}
            >
              {track.label}
            </span>
          ))}
        </div>
      </div>

      <div ref={viewportRef} className="relative min-w-0 flex-1 self-start overflow-x-auto">
        <div
          ref={contentRef}
          className="relative cursor-pointer touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
          style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
          role="slider"
          aria-label="Linha do tempo"
          aria-keyshortcuts="ArrowLeft ArrowRight Home End J K L"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalDuration)}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={formatTime(currentTime)}
          tabIndex={0}
          onPointerDown={onScrubPointerDown}
          onPointerMove={onScrubPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
        >
          {/* régua: faixa de retenção em cima, marcas de tempo embaixo */}
          <div className="relative overflow-hidden border-b border-border" style={{ height: rulerHeight }}>
            {zones.map((zone) => (
              <span
                key={zone.id}
                className="absolute top-0 flex items-center justify-center overflow-hidden text-[0.55rem] font-semibold uppercase leading-none tracking-wide"
                style={{
                  height: RETENTION_STRIP_HEIGHT,
                  left: `${pct(zone.from)}%`,
                  width: `${pct(zone.to - zone.from)}%`,
                  color: zone.color,
                  backgroundColor: `color-mix(in oklch, ${zone.color} 14%, transparent)`,
                }}
                title={`${zone.label}: ${formatTime(zone.from)}–${formatTime(zone.to)}`}
              >
                <span className="truncate px-1">{zone.label}</span>
              </span>
            ))}
            {ticks.map((time) => (
              <span
                key={time}
                className="pointer-events-none absolute bottom-0 h-1.5 border-l border-muted-foreground/40"
                style={{ left: `${pct(time)}%` }}
                aria-hidden
              >
                {/* Perto do fim o rótulo sairia da régua. */}
                {pct(time) < 96 ? (
                  <span className="absolute bottom-0.5 left-1 font-mono text-[0.55rem] leading-none tabular-nums text-muted-foreground">
                    {formatTime(time)}
                  </span>
                ) : null}
              </span>
            ))}
          </div>

          {/* trilhas */}
          <div className="relative" style={{ height: tracksHeight + 8 }}>
            <div className="absolute inset-x-0 top-1" style={{ height: tracksHeight }}>
              {layout.tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={cn("pointer-events-none absolute inset-x-0 rounded-sm", index % 2 === 0 ? "bg-muted/40" : "bg-muted/20")}
                  style={{ top: track.top, height: track.height }}
                  aria-hidden
                />
              ))}

              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="pointer-events-none absolute inset-y-0"
                  style={{
                    left: `${pct(zone.from)}%`,
                    width: `${pct(zone.to - zone.from)}%`,
                    backgroundColor: `color-mix(in oklch, ${zone.color} 7%, transparent)`,
                    borderLeft: `1px dashed color-mix(in oklch, ${zone.color} 40%, transparent)`,
                  }}
                  aria-hidden
                />
              ))}

              {/* trechos do vídeo, com o zoom de cada um */}
              {segmentsTrack && sourcePeaks.length > 0 ? (
                <div
                  className="pointer-events-none absolute overflow-hidden"
                  style={{
                    left: 0,
                    width: "100%",
                    top: segmentsTrack.top + 2,
                    height: segmentsTrack.height - 4,
                    opacity: sourceAudioDim ? 0.35 : 0.85,
                  }}
                  aria-hidden
                >
                  <AudioWaveform peaks={sourcePeaks} color="#d4d4d8" dim={sourceAudioDim} />
                </div>
              ) : null}

              {segmentsTrack
                ? (playbackSegments && playbackSegments.length > 0 ? playbackSegments : null)?.map((segment, index, all) => {
                    const widthPx = (pct(segment.outEnd - segment.outStart) / 100) * contentWidth
                    const zoom = sourceZoomPercent(segments.find((item) => item.index === segment.cutIndex)?.transform)
                    const label =
                      segment.kind === "freeze"
                        ? "Congelado"
                        : segment.kind === "rev"
                          ? `← Volta ${segment.speed.toFixed(2).replace(".", ",")}×`
                          : all.slice(0, index).some((item) => item.kind === "fwd")
                            ? "Loop"
                            : `Ida ${segment.speed.toFixed(2).replace(".", ",")}×`
                    return (
                      <div
                        key={`${segment.kind}-${index}`}
                        className={cn(
                          "pointer-events-none absolute flex items-center overflow-hidden rounded-[4px] border border-sky-400/40 bg-sky-400/15",
                          segment.kind === "rev" &&
                            "bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(14,165,233,0.28)_3px,rgba(14,165,233,0.28)_5px)]",
                          segment.cutIndex === activeSegmentIndex && "border-sky-400 bg-sky-400/25",
                        )}
                        style={{
                          left: `${pct(segment.outStart)}%`,
                          width: `${pct(segment.outEnd - segment.outStart)}%`,
                          top: segmentsTrack.top + 2,
                          height: segmentsTrack.height - 4,
                        }}
                        aria-hidden
                      >
                        {clipShowsLabel(widthPx) ? (
                          <span className="truncate px-2 font-mono text-[0.58rem] leading-none tabular-nums text-blue-900 dark:text-sky-200">
                            {label} · {zoom}%
                          </span>
                        ) : null}
                      </div>
                    )
                  }) ??
                  segments.map((segment) => {
                    const widthPx = (pct(segment.end - segment.start) / 100) * contentWidth
                    return (
                      <div
                        key={segment.index}
                        className={cn(
                          "pointer-events-none absolute flex items-center overflow-hidden rounded-[4px] border border-sky-400/40 bg-sky-400/15",
                          segments.length > 1 && segment.index === activeSegmentIndex && "border-sky-400 bg-sky-400/25",
                        )}
                        style={{
                          left: `${pct(segment.start)}%`,
                          width: `${pct(segment.end - segment.start)}%`,
                          top: segmentsTrack.top + 2,
                          height: segmentsTrack.height - 4,
                        }}
                        aria-hidden
                      >
                        {clipShowsLabel(widthPx) ? (
                          <span className="truncate px-2 font-mono text-[0.58rem] leading-none tabular-nums text-blue-900 dark:text-sky-200">
                            {segments.length > 1 ? `Trecho ${segment.index + 1} · ` : "Vídeo · "}
                            {sourceZoomPercent(segment.transform)}%
                          </span>
                        ) : null}
                      </div>
                    )
                  })
                : null}

              {/* divisões: clicar junta os dois trechos vizinhos */}
              {segmentsTrack && sourceCuts && onRemoveSourceCut
                ? sourceCuts.map((cut, index) => (
                    <button
                      key={`${index}-${cut.time}`}
                      type="button"
                      aria-label={`Juntar trechos em ${formatTime(cut.time)}`}
                      title={`Divisão em ${formatTime(cut.time)} · clique para juntar os trechos`}
                      disabled={exporting}
                      className="group/cut absolute z-[22] flex w-3 -translate-x-1/2 cursor-pointer justify-center disabled:pointer-events-none"
                      style={{ left: `${pct(cut.time)}%`, top: segmentsTrack.top, height: segmentsTrack.height }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveSourceCut(index)
                      }}
                    >
                      <span className="h-full w-0.5 rounded-full bg-sky-400 transition-colors group-hover/cut:bg-destructive" />
                      <Scissors className="absolute -top-1 size-2.5 rounded-sm bg-background text-sky-400 group-hover/cut:text-destructive" />
                    </button>
                  ))
                : null}

              {audioTracks.map((track) => {
                const range = trackOutputRange(track, totalDuration)
                const cycle = usableLength(track)
                const selected = track.id === selectedAudioId
                const peaks = slicePeaks(audioPeaks[track.fileId] ?? [], track.duration, track.trimIn, track.trimOut)
                const color = audioKindColor[track.kind]
                const top = (layout.clipTops.get(track.id) ?? 0) + 1
                const height = TIMELINE_AUDIO_LANE_HEIGHT - 2
                const repeats: { start: number; end: number }[] = []
                if (track.loop && cycle > 0.05) {
                  for (let at = track.start + cycle; at < totalDuration - 0.05; at += cycle) {
                    repeats.push({ start: at, end: Math.min(totalDuration, at + cycle) })
                  }
                }
                const blockStyle = (start: number, end: number) => ({
                  left: start <= 0 ? 0 : `${pct(start)}%`,
                  width: `${Math.max(pct(end - start), 0.4)}%`,
                  top,
                  height,
                })
                return (
                  <div key={track.id}>
                    {repeats.map((repeat) => (
                      <div
                        key={`${track.id}-${repeat.start}`}
                        className="pointer-events-none absolute overflow-hidden opacity-40"
                        style={{ ...blockStyle(repeat.start, repeat.end), backgroundColor: color }}
                        aria-hidden
                      />
                    ))}
                    <div
                      className={cn(
                        "absolute flex items-center overflow-hidden",
                        range.start > 0 ? "rounded-[3px]" : "rounded-r-[3px]",
                        selected && "z-[12] outline outline-1 outline-white",
                      )}
                      style={{ ...blockStyle(range.start, range.end), backgroundColor: color }}
                      onPointerDown={(event) => onAudioPointerDown(event, track, "move")}
                      onPointerMove={onAudioPointerMove}
                      onPointerUp={onAudioPointerUp}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectAudio?.(track.id)
                      }}
                    >
                      <AudioWaveform peaks={peaks} color="rgba(0,0,0,0.55)" />
                      <span className="relative z-10 mx-1 min-w-0 truncate rounded-sm bg-white/90 px-1 font-mono text-[0.6rem] leading-none text-zinc-950">
                        {track.fileName}
                      </span>
                      {selected ? (
                        <>
                          <span
                            className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-ew-resize bg-zinc-950/50"
                            onPointerDown={(event) => onAudioPointerDown(event, track, "in")}
                          />
                          <span
                            className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-ew-resize bg-zinc-950/50"
                            onPointerDown={(event) => onAudioPointerDown(event, track, "out")}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                )
              })}

              {inserts.map((insert) => {
                const widthPct = pct(insert.duration)
                const selected = selectedIdList.includes(insert.id)
                return (
                  <TimelineClipBar
                    key={insert.id}
                    insert={insert}
                    leftPct={pct(insert.start)}
                    widthPct={widthPct}
                    top={layout.clipTops.get(insert.id) ?? 0}
                    showLabel={clipShowsLabel((widthPct / 100) * contentWidth)}
                    selected={selected}
                    primary={selected && insert.id === selectedInsertId}
                    showHandles={singleSelection && insert.id === selectedInsertId}
                    pending={insert.id === pendingInsertId}
                    disabled={exporting}
                    onPointerDown={(event, handle) => onClipPointerDown(event, insert, handle)}
                    onContextMenu={(event) => openClipMenu(event, insert)}
                    motion={motionById?.[insert.id]}
                    onEmphasisMove={
                      onEmphasisMove ? (index, atFrame) => onEmphasisMove(insert.id, index, atFrame) : undefined
                    }
                    onEmphasisGesture={onEmphasisGesture}
                  />
                )
              })}
            </div>

            {/* corte: escurece o que fica fora */}
            {hasTrim ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 z-[15] bg-background/70"
                  style={{ width: `${pct(trimWindow.start)}%` }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 z-[15] bg-background/70"
                  style={{ width: `${pct(totalDuration - trimWindow.end)}%` }}
                  aria-hidden
                />
              </>
            ) : null}
            {hasTrim && canDragTrim
              ? (["in", "out"] as const).map((edge) => {
                  const at = edge === "in" ? trimWindow.start : trimWindow.end
                  return (
                    <div
                      key={edge}
                      role="slider"
                      tabIndex={-1}
                      aria-label={edge === "in" ? "Ponto de entrada" : "Ponto de saída"}
                      aria-valuemin={0}
                      aria-valuemax={Math.round(totalDuration)}
                      aria-valuenow={Math.round(at)}
                      title={`${edge === "in" ? "Entrada" : "Saída"} · ${formatTime(at)}`}
                      className={cn(
                        "absolute inset-y-0 z-[25] w-2.5 cursor-ew-resize border-amber-400 bg-amber-400/25",
                        edge === "in"
                          ? "rounded-l-sm border-y-2 border-l-[3px]"
                          : "-translate-x-full rounded-r-sm border-y-2 border-r-[3px]",
                        exporting && "pointer-events-none opacity-60",
                      )}
                      style={{ left: `${pct(at)}%` }}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => {
                        if (event.button !== 0 || exporting) return
                        event.preventDefault()
                        event.stopPropagation()
                        onTrimPointerDown(event, edge)
                      }}
                    />
                  )
                })
              : null}
          </div>

          {marquee ? (
            <div
              className="pointer-events-none absolute z-30 border border-sky-400 bg-sky-400/20"
              style={{
                left: marquee.left,
                top: marquee.top,
                width: Math.max(marquee.right - marquee.left, 1),
                height: Math.max(marquee.bottom - marquee.top, 1),
              }}
              aria-hidden
            />
          ) : null}
          {snapGuideTime != null && totalDuration > 0 ? (
            <div
              className="pointer-events-none absolute inset-y-0 z-[21] w-px bg-sky-400/90"
              style={{ left: `${pct(snapGuideTime)}%` }}
              aria-hidden
            />
          ) : null}
          {contextMenu ? (
            <div
              data-timeline-menu
              role="menu"
              className="fixed z-50 min-w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
              style={{
                left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220)),
                top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 168)),
              }}
            >
              {(
                [
                  ["duplicate", "Duplicar"],
                  ["delete", "Apagar"],
                  ["align", "Alinhar início ao cabeçote"],
                  ["track", "Selecionar todos desta faixa"],
                ] as const
              ).map(([command, label]) => (
                <button
                  key={command}
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onSelectionCommand?.(command, contextMenu.ids, contextMenu.primaryId)
                    setContextMenu(null)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {/* playhead: a cabeça na régua é a alça de arraste (o scrub do conteúdo faz o resto) */}
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-brand"
            style={{ left: `${progress}%` }}
            aria-hidden
          >
            <span className="absolute top-0 left-1/2 h-3 w-2.5 -translate-x-1/2 cursor-ew-resize rounded-b-sm bg-brand shadow" />
          </div>
        </div>
      </div>
    </div>
  )
}
