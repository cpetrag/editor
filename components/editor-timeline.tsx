"use client"

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Scissors } from "lucide-react"

import { TimelineClipBar } from "@/components/timeline-clip"
import { formatTime, type Insert } from "@/lib/inserts"
import { retentionZones } from "@/lib/insert-ops"
import { sourceZoomPercent } from "@/lib/source-transform"
import type { SourceCut, listSourceSegments } from "@/lib/source-segments"
import { clientXToTime, type TimelineHandle } from "@/lib/timeline-clip"
import {
  TIMELINE_ZOOM_MIN,
  clipShowsLabel,
  layoutTimelineTracks,
  scrollLeftForZoom,
  scrollLeftToReveal,
  zoomFromWheel,
} from "@/lib/timeline-layout"
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
  exporting: boolean
  showRetention: boolean
  segments: SourceSegment[]
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
}

export function EditorTimeline({
  totalDuration,
  currentTime,
  playing,
  inserts,
  selectedInsertId,
  exporting,
  showRetention,
  segments,
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
}: EditorTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const [viewportWidth, setViewportWidth] = useState(0)

  const layout = useMemo(() => layoutTimelineTracks(inserts), [inserts])
  const zones = useMemo(
    () => (showRetention && totalDuration > 0 ? retentionZones(totalDuration) : []),
    [showRetention, totalDuration],
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

  function onScrubPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || exporting || !(totalDuration > 0)) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ponteiro já solto (ex.: toque cancelado): o scrub segue só com os eventos que chegarem.
    }
    scrubbingRef.current = true
    onScrubStart?.()
    onSeek(timeAtClientX(event.clientX))
  }

  function onScrubPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbingRef.current) return
    onSeek(timeAtClientX(event.clientX))
  }

  function endScrub(event: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbingRef.current) return
    scrubbingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const segmentsTrack = layout.tracks.find((track) => track.id === "segments")
  const tracksHeight = layout.height

  return (
    <div data-editor-timeline className="flex max-h-[34vh] min-h-0 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-background/40">
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

      <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
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
              {segmentsTrack
                ? segments.map((segment) => {
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
                          <span className="truncate px-2 font-mono text-[0.58rem] leading-none tabular-nums text-sky-200">
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

              {inserts.map((insert) => {
                const widthPct = pct(insert.duration)
                return (
                  <TimelineClipBar
                    key={insert.id}
                    insert={insert}
                    leftPct={pct(insert.start)}
                    widthPct={widthPct}
                    top={layout.clipTops.get(insert.id) ?? 0}
                    showLabel={clipShowsLabel((widthPct / 100) * contentWidth)}
                    selected={selectedInsertId === insert.id}
                    disabled={exporting}
                    onPointerDown={(event, handle) => onClipPointerDown(event, insert, handle)}
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
