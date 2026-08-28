"use client"

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import {
  Play,
  Pause,
  RotateCcw,
  MonitorPlay,
  Smartphone,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Music2,
  Crop,
  LayoutGrid,
  Target,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { formatTime, type Insert } from "@/lib/inserts"
import { DEFAULT_CAPTION_STYLE, FONT_SIZE_MAX, FONT_SIZE_MIN, insertKind, resolveTimelineDuration, type CaptionPreset, type CaptionStyle, type Composition, type StyleRef, type TrackStyle, type TrackId } from "@/lib/composition"
import { PLAY_H, PLAY_W } from "@/lib/compose/layout"
import { rgbToHex } from "@/lib/canvas/eyedrop"
import { retentionZones, stackLanes } from "@/lib/insert-ops"
import { OverlayCanvas } from "@/components/overlay-canvas"
import { PreviewPlayer, type PreviewPlayerHandle } from "@/components/preview-player"
import { TimelineClipBar } from "@/components/timeline-clip"
import {
  clientXToTime,
  moveInsertTiming,
  trimInsertIn,
  trimInsertOut,
  type TimelineHandle,
} from "@/lib/timeline-clip"
import { canHandlePreviewNudge, cycleOverlayMode, type OverlayModeId } from "@/lib/compose/keyboard-scope"
import { secondsFromFrame, toRenderInsert, type RenderProps } from "@/remotion/types"
import { insertIdOf, type PreviewSelection } from "@/lib/preview-selection"
import type { SourceTransform } from "@/lib/source-transform"
import type { WatermarkPaint } from "@/lib/watermark"

function isPlayableBackgroundUrl(url: string): boolean {
  const value = url.trim()
  return value.startsWith("blob:") || value.startsWith("data:")
}

interface PreviewPanelProps {
  backgroundUrl: string
  inserts: Insert[]
  fontFamily: string
  timelineDuration: number
  showTimeline?: boolean
  exporting: boolean
  selection?: PreviewSelection
  sourceWidth: number
  sourceHeight: number
  sourceTransform?: SourceTransform
  logoSrc?: string
  fontId?: string
  stickerBlobUrls?: Record<string, string>
  captionPreset?: CaptionPreset
  captionStyle?: CaptionStyle
  styleRef?: StyleRef
  tracks?: Partial<Record<TrackId, TrackStyle>>
  customPresets?: Composition["customPresets"]
  watermark?: WatermarkPaint | null
  onPlayheadChange?: (time: number) => void
  onSelect?: (selection: PreviewSelection) => void
  onPatchInsert?: (id: string, patch: Partial<Insert>) => void
  onPatchCaptionStyle?: (patch: Partial<CaptionStyle>) => void
  onPatchSourceTransform?: (transform: SourceTransform) => void
  onResetSourceTransform?: () => void
  onRemoveInsert?: (id: string) => void
  onCreateTextAt?: (x: number, y: number) => void
  onDuplicateInsert?: (id: string) => void
  editingTextId?: string | null
  onEditingTextId?: (id: string | null) => void
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
  onMediaInfo: (info: {
    duration: number
    width: number
    height: number
    fps: number
  }) => void
}

export type PreviewHandle = {
  getVideo: () => HTMLVideoElement | null
  getCurrentTime: () => number
  seekTo: (seconds: number) => void
}

export const PreviewPanel = memo(
  forwardRef<PreviewHandle, PreviewPanelProps>(function PreviewPanel(
    {
      backgroundUrl,
      inserts,
      fontFamily,
      timelineDuration,
      showTimeline = true,
      exporting,
      selection = null,
      sourceWidth,
      sourceHeight,
      sourceTransform,
      logoSrc = "",
      fontId = "geist",
      stickerBlobUrls = {},
      captionPreset = "viral",
      captionStyle,
      styleRef,
      tracks,
      customPresets,
      watermark,
      onPlayheadChange,
      onSelect,
      onPatchInsert,
      onPatchCaptionStyle,
      onPatchSourceTransform,
      onResetSourceTransform,
      onRemoveInsert,
      onCreateTextAt,
      onDuplicateInsert,
      editingTextId = null,
      onEditingTextId,
      onBeginInsertGesture,
      onEndInsertGesture,
      onMediaInfo,
    },
    ref,
  ) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [overlay, setOverlay] = useState<OverlayModeId>("none")
  const [sourceFramingActive, setSourceFramingActive] = useState(false)
  const [showRetention, setShowRetention] = useState(true)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<PreviewPlayerHandle>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const insertsRef = useRef(inserts)
  const videoReadyRef = useRef(videoReady)
  const dragRef = useRef<{
    id: string
    mode: TimelineHandle
    grabOffset: number
    base: { start: number; duration: number }
    originX: number
    dragging: boolean
  } | null>(null)
  const playableUrl = isPlayableBackgroundUrl(backgroundUrl)
  insertsRef.current = inserts
  videoReadyRef.current = videoReady

  const totalDuration =
    timelineDuration > 0
      ? resolveTimelineDuration(timelineDuration)
      : videoDuration && videoDuration > 0
        ? resolveTimelineDuration(videoDuration)
        : 0
  const selectedInsertId = insertIdOf(selection)
  const selectedInsert = inserts.find((insert) => insert.id === selectedInsertId) ?? null
  const selectedText =
    selectedInsert && insertKind(selectedInsert) === "text" ? selectedInsert : null

  function samplePlayColor(playX: number, playY: number): string | null {
    const host = playerRef.current?.getContainerNode()
    const canvas = host?.querySelector("canvas")
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 2 || canvas.height < 2) {
      return null
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    const x = Math.round((playX / PLAY_W) * canvas.width)
    const y = Math.round((playY / PLAY_H) * canvas.height)
    const pixel = ctx.getImageData(Math.max(0, Math.min(canvas.width - 1, x)), Math.max(0, Math.min(canvas.height - 1, y)), 1, 1).data
    return rgbToHex(pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0)
  }

  const renderFps = 30
  const renderProps: RenderProps = useMemo(
    () => ({
      video: {
        src: playableUrl ? backgroundUrl : "",
        durationInSeconds: totalDuration,
        width: sourceWidth || 1080,
        height: sourceHeight || 1920,
        ...(sourceTransform ? { transform: sourceTransform } : {}),
      },
      fps: renderFps,
      width: 1080,
      height: 1920,
      inserts: inserts.map(toRenderInsert),
      brand: { fontId, logo: logoSrc },
      captionPreset,
      captionStyle: captionStyle ?? DEFAULT_CAPTION_STYLE,
      stickerSrcs: stickerBlobUrls,
      ...(styleRef ? { styleRef } : {}),
      ...(tracks ? { tracks } : {}),
      ...(customPresets ? { customPresets } : {}),
    }),
    [
      backgroundUrl,
      captionPreset,
      captionStyle,
      customPresets,
      fontId,
      inserts,
      logoSrc,
      playableUrl,
      sourceHeight,
      sourceTransform,
      sourceWidth,
      stickerBlobUrls,
      styleRef,
      totalDuration,
      tracks,
    ],
  )

  useEffect(() => {
    setVideoReady(false)
    setVideoDuration(null)
    setVideoError(false)
    setPlaying(false)
    setCurrentTime(0)
  }, [backgroundUrl])

  useEffect(() => {
    onPlayheadChange?.(currentTime)
  }, [currentTime, onPlayheadChange])

  const onPlayerFrame = useCallback((frame: number) => {
    setCurrentTime(secondsFromFrame(frame, renderFps))
  }, [])

  const onPlayerPlayingChange = useCallback((nextPlaying: boolean) => {
    setPlaying(nextPlaying)
  }, [])

  function seekTo(next: number) {
    const clamped = Math.min(totalDuration, Math.max(0, next))
    setCurrentTime(clamped)
    playerRef.current?.seekToFrame(Math.round(clamped * renderFps))
    const video = videoRef.current
    if (video && videoReady) {
      video.currentTime = clamped
    }
  }

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
    getCurrentTime: () => currentTime,
    seekTo,
  }))

  function seekFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    if (dragRef.current?.dragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seekTo(ratio * totalDuration)
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current
      const track = trackRef.current
      if (!drag || !track) return
      if (!drag.dragging && Math.abs(event.clientX - drag.originX) < 3) return
      drag.dragging = true
      const time = clientXToTime(event.clientX, track.getBoundingClientRect(), totalDuration)
      const next =
        drag.mode === "in"
          ? trimInsertIn(drag.base, time, totalDuration)
          : drag.mode === "out"
            ? trimInsertOut(drag.base, time, totalDuration)
            : moveInsertTiming(drag.base, time - drag.grabOffset, totalDuration)
      onPatchInsert?.(drag.id, next)
    }

    function onUp() {
      const drag = dragRef.current
      if (!drag) return
      if (!drag.dragging) {
        const insert = insertsRef.current.find((item) => item.id === drag.id)
        if (insert) {
          const clamped = Math.min(totalDuration, Math.max(0, insert.start))
          setCurrentTime(clamped)
          playerRef.current?.seekToFrame(Math.round(clamped * renderFps))
          const video = videoRef.current
          if (video && videoReadyRef.current) {
            video.currentTime = clamped
          }
        }
      }
      dragRef.current = null
      onEndInsertGesture?.()
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [onEndInsertGesture, onPatchInsert, totalDuration])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!canHandlePreviewNudge(event, selection)) return
      const selectedInsertId = insertIdOf(selection)
      if (typeof selectedInsertId !== "string") return
      if (event.key !== "Delete" && event.key !== "Backspace") return
      event.preventDefault()
      event.stopPropagation()
      onRemoveInsert?.(selectedInsertId)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onRemoveInsert, selection])

  async function togglePlay() {
    const player = playerRef.current
    if (player) {
      if (player.isPlaying()) {
        player.pause()
        return
      }
      if (currentTime >= totalDuration - 0.05) {
        seekTo(0)
      }
      player.play()
      return
    }
    setCurrentTime((t) => (t >= totalDuration ? 0 : t))
    setPlaying((p) => !p)
  }

  function reset() {
    setPlaying(false)
    seekTo(0)
    playerRef.current?.pause()
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
  }

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0
  const insertLanes = useMemo(() => stackLanes(inserts), [inserts])
  const laneCount = useMemo(() => {
    let maxLane = 0
    for (const lane of insertLanes.values()) {
      if (lane > maxLane) maxLane = lane
    }
    return Math.max(1, maxLane + 1)
  }, [insertLanes])
  const timelineHeight = Math.max(36, 8 + laneCount * 14)

  const overlayOptions: { id: OverlayModeId; label: string; icon: typeof Crop }[] = [
    { id: "none", label: "Limpo", icon: MonitorPlay },
    { id: "safe", label: "Safe area", icon: Crop },
    { id: "feed", label: "Feed", icon: LayoutGrid },
  ]

  return (
    <section className="flex h-full min-h-0 flex-col bg-muted/30">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MonitorPlay className="size-4" />
          <span className="font-medium text-foreground">Pré-visualização</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Overlay switch */}
          <div
            role="radiogroup"
            data-preview-overlay
            aria-label="Modo de pré-visualização"
            className="flex items-center rounded-full border border-border p-0.5"
            onKeyDown={(event) => {
              if (event.defaultPrevented) return
              const next = cycleOverlayMode(overlay, event.key)
              if (!next) return
              event.preventDefault()
              event.stopPropagation()
              setOverlay(next)
            }}
          >
            {overlayOptions.map((opt) => {
              const Icon = opt.icon
              const active = overlay === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setOverlay(opt.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            <Smartphone className="size-3.5" />
            9:16
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Stage */}
      <div className="grid min-h-0 flex-1 place-items-center p-6">
        <div className="flex h-full max-h-[80vh] items-stretch gap-3">
          {selectedText ? (
            <label className="flex flex-col items-center justify-center gap-2 text-[0.65rem] text-muted-foreground">
              <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">Tamanho</span>
              <input
                type="range"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                value={selectedText.fontSize ?? FONT_SIZE_MIN}
                aria-label="Tamanho do texto"
                className="h-40 w-6 cursor-pointer accent-sky-400"
                style={{ writingMode: "vertical-lr", direction: "rtl" }}
                onPointerDown={() => onBeginInsertGesture?.()}
                onPointerUp={() => onEndInsertGesture?.()}
                onChange={(event) =>
                  onPatchInsert?.(selectedText.id, { fontSize: Number(event.target.value) })
                }
              />
              <span className="font-mono text-[0.65rem] tabular-nums text-zinc-300">
                {Math.round(selectedText.fontSize ?? FONT_SIZE_MIN)}
              </span>
            </label>
          ) : null}
        <div className="relative aspect-[9/16] h-full max-h-[80vh] w-auto overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/50">
          {/* subtle grid so empty space doesn't look broken */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
            aria-hidden
          />

          {!videoError ? (
            <PreviewPlayer
              ref={playerRef}
              renderProps={renderProps}
              onFrame={onPlayerFrame}
              onPlayingChange={onPlayerPlayingChange}
            />
          ) : null}

          {playableUrl ? (
            <video
              key={backgroundUrl}
              ref={videoRef}
              src={backgroundUrl}
              className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
              playsInline
              preload="auto"
              onLoadedMetadata={(event) => {
                const el = event.currentTarget
                const duration = el.duration
                if (Number.isFinite(duration) && duration > 0) {
                  setVideoDuration(duration)
                  onMediaInfo({
                    duration,
                    width: el.videoWidth || 1080,
                    height: el.videoHeight || 1920,
                    fps: 30,
                  })
                }
              }}
              onCanPlay={() => {
                setVideoReady(true)
                setVideoError(false)
              }}
              onError={() => {
                setVideoReady(false)
                setVideoError(true)
              }}
            />
          ) : null}

          {(videoError || (playableUrl && !videoReady) || (!playableUrl && inserts.length === 0)) && (
            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 px-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300">
                {playableUrl && !videoError ? (
                  <Spinner className="size-6" />
                ) : (
                  <MonitorPlay className="size-6" />
                )}
              </span>
              {videoError ? (
                <p className="max-w-[16rem] text-pretty text-sm leading-relaxed text-zinc-400">
                  Não foi possível reproduzir este arquivo no navegador. Tente um
                  MP4 (H.264).
                </p>
              ) : playableUrl ? (
                <p className="max-w-[16rem] text-pretty text-sm leading-relaxed text-zinc-400">
                  Carregando vídeo no player…
                </p>
              ) : (
                <>
                  <p className="max-w-[16rem] text-pretty text-sm leading-relaxed text-zinc-400">
                    Importe um arquivo ou baixe um vídeo pelo link (YouTube,
                    TikTok, Instagram, Pinterest, X ou Shopee Video).
                  </p>
                  <p className="text-xs text-zinc-600">Nenhum vídeo de fundo definido</p>
                </>
              )}
            </div>
          )}

          <OverlayCanvas
            inserts={inserts}
            time={currentTime}
            fontId={fontId}
            fontFamily={fontFamily}
            logoSrc={logoSrc}
            blobUrls={stickerBlobUrls}
            captionPreset={captionPreset}
            captionStyle={captionStyle}
            selection={selection}
            sourceWidth={sourceWidth}
            sourceHeight={sourceHeight}
            sourceTransform={sourceTransform}
            watermark={watermark}
            // Preview player freezes inserts while paused; this canvas redraws on inserts/time.
            paintVisual
            tracks={tracks}
            project={styleRef ? { styleRef } : {}}
            videoDuration={totalDuration}
            customPresets={customPresets ? Object.values(customPresets) : undefined}
            onSelect={onSelect}
            onPatchInsert={onPatchInsert}
            onPatchCaptionStyle={onPatchCaptionStyle}
            onPatchSourceTransform={onPatchSourceTransform}
            onSourceFramingActive={setSourceFramingActive}
            onResetSourceTransform={onResetSourceTransform}
            onBeginInsertGesture={onBeginInsertGesture}
            onEndInsertGesture={onEndInsertGesture}
            onCreateTextAt={onCreateTextAt}
            onDuplicateInsert={onDuplicateInsert}
            editingTextId={editingTextId}
            onEditingTextId={onEditingTextId}
            onSamplePlayColor={samplePlayColor}
            onOpenAdvanced={() => {
              const id = selectedText?.id
              if (!id) return
              document.querySelector(`[data-insert-id="${id}"]`)?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
              })
            }}
          />

          {/* Overlays */}
          {(overlay === "safe" || sourceFramingActive) && <SafeAreaOverlay />}
          {overlay === "feed" && <FeedMockup />}

          {/* Time HUD */}
          <div className="absolute bottom-3 left-3 z-20 rounded-md bg-black/60 px-2 py-1 font-mono text-xs tabular-nums text-zinc-300 backdrop-blur-sm">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>
        </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              onClick={togglePlay}
              disabled={exporting || !playableUrl}
              aria-label={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={reset}
              aria-label="Reiniciar"
            >
              <RotateCcw />
            </Button>
            {showTimeline ? (
            <Button
              variant={showRetention ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setShowRetention((s) => !s)}
              aria-label="Mostrar marcadores de retenção"
              aria-pressed={showRetention}
            >
              <Target />
            </Button>
            ) : null}
          </div>

          {/* Timeline */}
          {showTimeline && totalDuration > 0 ? (
          <div className="flex flex-1 items-center gap-3">
            <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1">
              {/* Retention zone labels */}
              {showRetention && (
                <div className="relative mb-1 h-4">
                  {retentionZones(totalDuration).map((zone) => {
                    const left = (zone.from / totalDuration) * 100
                    const width = ((zone.to - zone.from) / totalDuration) * 100
                    return (
                      <span
                        key={zone.id}
                        className="absolute top-0 flex h-full items-center justify-center rounded-sm text-[0.6rem] font-semibold uppercase tracking-wide"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          color: zone.color,
                          backgroundColor: `color-mix(in oklch, ${zone.color} 16%, transparent)`,
                        }}
                        title={`${zone.label}: ${formatTime(zone.from)}–${formatTime(zone.to)}`}
                      >
                        <span className="truncate px-1">{zone.label}</span>
                      </span>
                    )
                  })}
                </div>
              )}

              <div
                ref={trackRef}
                className="group/timeline relative cursor-pointer select-none"
                style={{ height: timelineHeight }}
                onClick={seekFromEvent}
                role="slider"
                aria-label="Linha do tempo"
                aria-valuemin={0}
                aria-valuemax={Math.round(totalDuration)}
                aria-valuenow={Math.round(currentTime)}
                tabIndex={0}
              >
                {/* retention zone bands (behind the track) */}
                {showRetention &&
                  retentionZones(totalDuration).map((zone) => {
                    const left = (zone.from / totalDuration) * 100
                    const width = ((zone.to - zone.from) / totalDuration) * 100
                    return (
                      <div
                        key={zone.id}
                        className="absolute inset-y-0 rounded-md"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: `color-mix(in oklch, ${zone.color} 10%, transparent)`,
                          borderLeft: `1px dashed color-mix(in oklch, ${zone.color} 45%, transparent)`,
                        }}
                        aria-hidden
                      />
                    )
                  })}

                {/* track */}
                <div className="absolute inset-x-0 bottom-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand/70"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* insert markers */}
                {inserts.map((insert) => {
                  const left = (insert.start / totalDuration) * 100
                  const width = (insert.duration / totalDuration) * 100
                  const lane = insertLanes.get(insert.id) ?? 0
                  return (
                    <TimelineClipBar
                      key={insert.id}
                      insert={insert}
                      leftPct={left}
                      widthPct={width}
                      top={2 + lane * 14}
                      selected={insertIdOf(selection) === insert.id}
                      disabled={exporting}
                      onPointerDown={(event, handle) => {
                        if (event.button !== 0 || exporting) return
                        event.preventDefault()
                        event.stopPropagation()
                        const track = trackRef.current
                        if (!track) return
                        const time = clientXToTime(
                          event.clientX,
                          track.getBoundingClientRect(),
                          totalDuration,
                        )
                        onSelect?.({ kind: "insert", id: insert.id })
                        onBeginInsertGesture?.()
                        dragRef.current = {
                          id: insert.id,
                          mode: handle,
                          grabOffset: time - insert.start,
                          base: { start: insert.start, duration: insert.duration },
                          originX: event.clientX,
                          dragging: false,
                        }
                      }}
                    />
                  )
                })}

                {/* playhead */}
                <div
                  className="pointer-events-none absolute inset-y-0 z-20 w-px bg-brand"
                  style={{ left: `${progress}%` }}
                >
                  <span className="absolute -top-0.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 border-background bg-brand shadow" />
                </div>
              </div>
            </div>

            <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {formatTime(totalDuration)}
            </span>
          </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}),
)
PreviewPanel.displayName = "PreviewPanel"

/* ------------------------------------------------------------------ */
/* Safe area guides (Reels / TikTok)                                   */
/* ------------------------------------------------------------------ */

function SafeAreaOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden>
      {/* top unsafe band */}
      <div className="absolute inset-x-0 top-0 h-[12%] bg-red-500/10">
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[0.6rem] font-medium text-red-200">
          Topo coberto
        </span>
      </div>
      {/* bottom unsafe band */}
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-red-500/10">
        <span className="absolute top-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[0.6rem] font-medium text-red-200">
          Legenda / áudio
        </span>
      </div>
      {/* right unsafe column (action buttons) */}
      <div className="absolute inset-y-0 right-0 w-[16%] bg-red-500/10" />

      {/* crop guides 4:5 and 1:1 */}
      <CropGuide ratio={4 / 5} label="4:5" />
      <CropGuide ratio={1} label="1:1" />
    </div>
  )
}

function CropGuide({ ratio, label }: { ratio: number; label: string }) {
  // 9:16 frame; a centered crop of the given aspect ratio has this height fraction.
  const frameRatio = 9 / 16
  const heightFraction = (frameRatio / ratio) * 100
  const topFraction = (100 - heightFraction) / 2
  return (
    <div
      className="absolute inset-x-0 border-y border-dashed border-white/50"
      style={{ top: `${topFraction}%`, height: `${heightFraction}%` }}
    >
      <span className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[0.55rem] font-medium text-white">
        {label}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Feed mockup (Instagram Reels-style chrome)                          */
/* ------------------------------------------------------------------ */

function FeedMockup() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] text-white" aria-hidden>
      {/* top gradient + tabs */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-0 top-4 flex items-center justify-center gap-4 text-sm font-semibold">
        <span className="text-white/60">Seguindo</span>
        <span className="border-b-2 border-white pb-0.5">Para você</span>
      </div>

      {/* right action rail */}
      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4">
        <FeedAction icon={Heart} value="12,4 mil" />
        <FeedAction icon={MessageCircle} value="842" />
        <FeedAction icon={Send} value="Enviar" />
        <FeedAction icon={Bookmark} value="Salvar" />
        <span className="mt-1 flex size-8 items-center justify-center rounded-lg border border-white/40 bg-black/40">
          <Music2 className="size-4" />
        </span>
      </div>

      {/* bottom caption */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pr-16 pb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="size-7 rounded-full bg-gradient-to-br from-brand to-track-desconto" />
          <span className="text-sm font-semibold">@sua_loja</span>
          <span className="rounded border border-white/50 px-1.5 py-0.5 text-[0.6rem] font-medium">
            Seguir
          </span>
        </div>
        <p className="text-xs leading-snug text-white/90">
          Oferta imperdível hoje! Corre que é por tempo limitado 🔥
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-white/80">
          <Music2 className="size-3" />
          <span className="truncate">áudio original · sua_loja</span>
        </div>
      </div>
    </div>
  )
}

function FeedAction({
  icon: Icon,
  value,
}: {
  icon: typeof Heart
  value: string
}) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <Icon className="size-6 drop-shadow" />
      <span className="text-[0.6rem] font-medium drop-shadow">{value}</span>
    </span>
  )
}
