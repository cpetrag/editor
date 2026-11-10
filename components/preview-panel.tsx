"use client"

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react"
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
  Scissors,
  X,
  ZoomIn,
  ZoomOut,
  Keyboard,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { formatTime, type Insert, type InsertType } from "@/lib/inserts"
import { formatTimecode } from "@/lib/timecode"
import { fitPreviewFrame } from "@/lib/preview-frame"
import { TextCommitBar } from "@/components/text-commit-bar"
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts"
import { DEFAULT_CAPTION_STYLE, insertKind, resolveTimelineDuration, type CaptionPreset, type CaptionStyle, type Composition, type StyleRef, type TrackStyle, type TrackId } from "@/lib/composition"
import { INSERT_SIZE_PERCENT_MAX, INSERT_SIZE_PERCENT_MIN, insertWithSize, sizePercentOf } from "@/lib/content/gallery"
import { PLAY_H, PLAY_W } from "@/lib/compose/layout"
import { rgbToHex } from "@/lib/canvas/eyedrop"
import { ExportCompareLayer, type ExportCompareMode } from "@/components/export-compare-layer"
import { OverlayCanvas } from "@/components/overlay-canvas"
import { SourceZoomSlider } from "@/components/source-zoom-slider"
import { PreviewPlayer, type PreviewPlayerHandle } from "@/components/preview-player"
import { PanelErrorBoundary } from "@/components/panel-error-boundary"
import { EditorTimeline } from "@/components/editor-timeline"
import { clipMotionMarks, moveEmphasis } from "@/lib/motion/select"
import { resolveStyleForEditor } from "@/lib/style/editor-style"
import { trackStyleForInsert } from "@/lib/style-preset"
import { ShortcutHelpDialog } from "@/components/shortcut-help-dialog"
import {
  clientXToTime,
  moveInsertTiming,
  stepFrameIndex,
  trimInsertIn,
  trimInsertOut,
  type TimelineHandle,
} from "@/lib/timeline-clip"
import { TIMELINE_ZOOM_MAX, TIMELINE_ZOOM_MIN, clampTimelineZoom } from "@/lib/timeline-layout"
import {
  moveTimelineGroup,
  nextClickSelection,
  selectableItems,
  idsOnTrack,
  selectAllItems,
  snapTargetTimes,
  snapToleranceSeconds,
  type TimelineItem,
} from "@/lib/timeline-selection"
import { cycleIndex, editorShortcutAction, JKL_SEEK_SECONDS } from "@/lib/editor-shortcuts"
import {
  cycleOverlayMode,
  frameStepKeyAction,
  isTimelineOrPreviewTarget,
  SPLIT_HINT,
  TRIM_HINT,
  timelineSelectionKey,
  type OverlayModeId,
} from "@/lib/compose/keyboard-scope"
import { secondsFromFrame, toRenderInsert, type RenderProps } from "@/remotion/types"
import { insertIdOf, insertSelection, selectedIdsOf, type PreviewSelection } from "@/lib/preview-selection"
import { sourceZoomPercent, type SourceTransform } from "@/lib/source-transform"
import {
  canSplitSourceAt,
  listSourceSegments,
  segmentIndexAt,
  sourceTransformAt,
  type SourceCut,
} from "@/lib/source-segments"
import {
  clampSourceTrim,
  markTrimIn,
  markTrimOut,
  resolveTrimWindow,
  type SourceTrim,
} from "@/lib/source-trim"
import type { WatermarkPaint } from "@/lib/watermark"
import { defaultCompositionAudio, type AudioTrack, type CompositionAudio } from "@/lib/audio/types"
import { scrollIntoPanelViewport } from "@/lib/scroll-panel"

/** Uma linha da barra de estilo: size-7 (28) + py-1.5 (12) + borda (2) + folga. */
const STYLE_BAR_SLOT_PX = 44

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
  retentionCuts?: { ganchoEnd: number; ctaStart: number } | null
  exporting: boolean
  selection?: PreviewSelection
  sourceWidth: number
  sourceHeight: number
  sourceTransform?: SourceTransform
  sourceCuts?: SourceCut[]
  onSplitSource?: (time: number) => void
  onRemoveSourceCut?: (index: number) => void
  trim?: SourceTrim
  /** `gesture` durante o arraste das alças; `discrete` para botões e atalhos. */
  onChangeTrim?: (trim: SourceTrim | null, mode: "discrete" | "gesture") => void
  logoSrc?: string
  fontId?: string
  stickerBlobUrls?: Record<string, string>
  captionPreset?: CaptionPreset
  captionStyle?: CaptionStyle
  styleRef?: StyleRef
  productData?: Composition["productData"]
  brandKitId?: Composition["brandKitId"]
  tracks?: Partial<Record<TrackId, TrackStyle>>
  customPresets?: Composition["customPresets"]
  watermark?: WatermarkPaint | null
  audio?: CompositionAudio
  audioUrls?: Record<string, string>
  audioPeaks?: Record<string, number[]>
  sourcePeaks?: number[]
  selectedAudioId?: string | null
  onSelectAudio?: (id: string) => void
  onAudioEdit?: (id: string, patch: Partial<AudioTrack>, phase: "start" | "move" | "end") => void
  onPlayheadChange?: (time: number) => void
  onSelect?: (selection: PreviewSelection) => void
  onPatchInsert?: (id: string, patch: Partial<Insert>) => void
  onPatchCaptionStyle?: (patch: Partial<CaptionStyle>) => void
  /** `time` indica o trecho editado (o do playhead). */
  onPatchSourceTransform?: (transform: SourceTransform, time: number) => void
  onResetSourceTransform?: (time: number) => void
  onRemoveInsert?: (id: string) => void
  onPatchTimings?: (patches: { id: string; start: number; duration: number }[]) => void
  onDeleteSelection?: (ids: string[]) => void
  onDuplicateSelection?: (ids: string[]) => void
  onNudgeSelection?: (ids: string[], frames: number) => void
  onAlignSelection?: (primaryId: string, ids: string[]) => void
  onCreateTextAt?: (x: number, y: number) => void
  onDuplicateInsert?: (id: string) => void
  editingTextId?: string | null
  onEditingTextId?: (id: string | null) => void
  onCancelTextEdit?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onOpenExport?: () => void
  /** Diálogos do editor (export, nome) em que Espaço e setas não devem agir. */
  suspendShortcuts?: boolean
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
  /** Desfazer/Refazer, estado do salvamento e Exportar, à direita da barra superior. */
  headerActions?: React.ReactNode
  onMediaInfo: (info: {
    duration: number
    width: number
    height: number
    fps: number
  }) => void
  comboPreviewLabel?: string | null
  comboConfirming?: boolean
  onApplyComboPreview?: () => void
  onConfirmComboPreview?: (mode: "add" | "replace") => void
  onCancelComboPreview?: () => void
  onDropElement?: (type: InsertType, x: number, y: number) => void
  onPatchInsertStyle?: (id: string, path: string, value: unknown) => void
}

export type PreviewHandle = {
  getVideo: () => HTMLVideoElement | null
  getCurrentTime: () => number
  seekTo: (seconds: number) => void
  playRange: (start: number, end: number) => void
}

export const PreviewPanel = memo(
  forwardRef<PreviewHandle, PreviewPanelProps>(function PreviewPanel(
    {
      backgroundUrl,
      inserts,
      fontFamily,
      timelineDuration,
      showTimeline = true,
      retentionCuts = null,
      exporting,
      selection = null,
      sourceWidth,
      sourceHeight,
      sourceTransform,
      sourceCuts,
      onSplitSource,
      onRemoveSourceCut,
      trim,
      onChangeTrim,
      logoSrc = "",
      fontId = "geist",
      stickerBlobUrls = {},
      captionPreset = "viral",
      captionStyle,
      styleRef,
      productData,
      brandKitId,
      tracks,
      customPresets,
      watermark,
      audio,
      audioUrls = {},
      audioPeaks = {},
      sourcePeaks = [],
      selectedAudioId = null,
      onSelectAudio,
      onAudioEdit,
      onPlayheadChange,
      onSelect,
      onPatchInsert,
      onPatchCaptionStyle,
      onPatchSourceTransform,
      onResetSourceTransform,
      onRemoveInsert,
      onPatchTimings,
      onDeleteSelection,
      onDuplicateSelection,
      onNudgeSelection,
      onAlignSelection,
      onCreateTextAt,
      onDuplicateInsert,
      editingTextId = null,
      onEditingTextId,
      onCancelTextEdit,
      onUndo,
      onRedo,
      onOpenExport,
      suspendShortcuts = false,
      onBeginInsertGesture,
      onEndInsertGesture,
      headerActions,
      onMediaInfo,
      comboPreviewLabel = null,
      comboConfirming = false,
      onApplyComboPreview,
      onConfirmComboPreview,
      onCancelComboPreview,
      onDropElement,
      onPatchInsertStyle,
    },
    ref,
  ) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [overlay, setOverlay] = useState<OverlayModeId>("none")
  const [exportCompare, setExportCompare] = useState<ExportCompareMode>("off")
  const [sourceFramingActive, setSourceFramingActive] = useState(false)
  const [showRetention, setShowRetention] = useState(true)
  const [timelineZoom, setTimelineZoom] = useState(TIMELINE_ZOOM_MIN)
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [framePx, setFramePx] = useState({ width: 0, height: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const leftRailRef = useRef<HTMLDivElement>(null)
  const rightRailRef = useRef<HTMLDivElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null)
  const [floatingBarHost, setFloatingBarHost] = useState<HTMLDivElement | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<PreviewPlayerHandle>(null)
  const soloRef = useRef<{ start: number; end: number } | null>(null)
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
    groupIds: string[]
    collapseToId: string | null
    items: TimelineItem[]
  } | null>(null)
  const trimDragRef = useRef<{ edge: "in" | "out"; dragging: boolean } | null>(null)
  const playableUrl = isPlayableBackgroundUrl(backgroundUrl)
  insertsRef.current = inserts
  videoReadyRef.current = videoReady

  const totalDuration =
    timelineDuration > 0
      ? resolveTimelineDuration(timelineDuration)
      : videoDuration && videoDuration > 0
        ? resolveTimelineDuration(videoDuration)
        : 0
  const activeTrim = timelineDuration > 0 ? clampSourceTrim(trim, timelineDuration) : null
  const trimWindow = resolveTrimWindow({ duration: totalDuration, trim: activeTrim ?? undefined })
  const trimWindowRef = useRef(trimWindow)
  trimWindowRef.current = trimWindow
  const totalDurationRef = useRef(totalDuration)
  totalDurationRef.current = totalDuration
  const motionById = useMemo(() => {
    const map: Record<string, ReturnType<typeof clipMotionMarks>> = {}
    const project = { styleRef }
    for (const insert of inserts) {
      if (insertKind(insert) === "sticker") continue
      const track = trackStyleForInsert(insert, tracks, totalDuration)
      map[insert.id] = clipMotionMarks(
        resolveStyleForEditor(insert, track, project).animation,
        insert.duration,
        30,
      )
    }
    return map
  }, [inserts, styleRef, totalDuration, tracks])
  const currentTimeRef = useRef(0)
  const framing = useMemo(
    () => ({ transform: sourceTransform, cuts: sourceCuts }),
    [sourceCuts, sourceTransform],
  )
  const segments = useMemo(
    () => listSourceSegments(framing, totalDuration),
    [framing, totalDuration],
  )
  const activeSegmentIndex = segmentIndexAt(sourceCuts, currentTime)
  // Zoom, arraste e reset no preview agem sobre o trecho sob o playhead.
  const activeSourceTransform = sourceTransformAt(framing, currentTime)
  const canSplitHere =
    Boolean(onSplitSource) &&
    timelineDuration > 0 &&
    canSplitSourceAt(framing, currentTime, timelineDuration)
  const patchActiveSourceTransform = useMemo(
    () =>
      onPatchSourceTransform
        ? (transform: SourceTransform) =>
            onPatchSourceTransform(transform, currentTimeRef.current)
        : undefined,
    [onPatchSourceTransform],
  )
  const resetActiveSourceTransform = useMemo(
    () =>
      onResetSourceTransform
        ? () => onResetSourceTransform(currentTimeRef.current)
        : undefined,
    [onResetSourceTransform],
  )
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
        ...(sourceCuts ? { cuts: sourceCuts } : {}),
      },
      fps: renderFps,
      width: 1080,
      height: 1920,
      inserts: inserts.map(toRenderInsert),
      brand: { fontId, logo: logoSrc },
      captionPreset,
      captionStyle: captionStyle ?? DEFAULT_CAPTION_STYLE,
      stickerSrcs: stickerBlobUrls,
      audio: {
        original: (audio ?? defaultCompositionAudio()).original,
        ducking: (audio ?? defaultCompositionAudio()).ducking,
        tracks: (audio ?? defaultCompositionAudio()).tracks.map((track) => ({
          ...track,
          src: audioUrls[track.fileId] ?? "",
        })),
      },
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
      sourceCuts,
      sourceHeight,
      sourceTransform,
      sourceWidth,
      audio,
      audioUrls,
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
    const time = secondsFromFrame(frame, renderFps)
    const span = trimWindowRef.current
    const player = playerRef.current
    const solo = soloRef.current
    if (player?.isPlaying() && solo && time >= solo.end - 0.5 / renderFps) {
      player.seekToFrame(Math.round(solo.start * renderFps))
      currentTimeRef.current = solo.start
      setCurrentTime(solo.start)
      return
    }
    // O Player toca o arquivo inteiro; a saída do corte para a reprodução aqui.
    if (player?.isPlaying() && span.end < totalDurationRef.current && time >= span.end) {
      player.pause()
      player.seekToFrame(Math.round(span.end * renderFps))
      currentTimeRef.current = span.end
      setCurrentTime(span.end)
      return
    }
    currentTimeRef.current = time
    setCurrentTime(time)
  }, [])

  const onPlayerPlayingChange = useCallback((nextPlaying: boolean) => {
    setPlaying(nextPlaying)
  }, [])

  function seekTo(next: number, options?: { keepSolo?: boolean }) {
    if (!options?.keepSolo) soloRef.current = null
    const clamped = Math.min(totalDuration, Math.max(0, next))
    currentTimeRef.current = clamped
    setCurrentTime(clamped)
    playerRef.current?.seekToFrame(Math.round(clamped * renderFps))
    const video = videoRef.current
    if (video && videoReady) {
      video.currentTime = clamped
    }
  }

  function playRange(start: number, end: number) {
    const loopEnd = Math.max(start + 1 / renderFps, end)
    soloRef.current = { start, end: loopEnd }
    seekTo(start, { keepSolo: true })
    playerRef.current?.play()
  }

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
    getCurrentTime: () => currentTime,
    seekTo,
    playRange,
  }))

  const pauseForScrub = useCallback(() => {
    const player = playerRef.current
    if (player?.isPlaying()) player.pause()
  }, [])

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current
      const track = trackRef.current
      if (!drag || !track) return
      if (!drag.dragging && Math.abs(event.clientX - drag.originX) < 3) return
      drag.dragging = true
      const rect = track.getBoundingClientRect()
      const time = clientXToTime(event.clientX, rect, totalDuration)
      if (drag.mode === "in" || drag.mode === "out") {
        const next =
          drag.mode === "in"
            ? trimInsertIn(drag.base, time, totalDuration)
            : trimInsertOut(drag.base, time, totalDuration)
        onPatchInsert?.(drag.id, next)
        return
      }
      const limit = trimWindowRef.current.end > 0 ? trimWindowRef.current.end : totalDuration
      const proposed = moveInsertTiming(drag.base, time - drag.grabOffset, limit)
      const moved = moveTimelineGroup({
        items: drag.items,
        selectedIds: drag.groupIds,
        delta: proposed.start - drag.base.start,
        videoDuration: totalDuration,
        snapTolerance: event.altKey ? 0 : snapToleranceSeconds(rect.width, totalDuration),
        snapTargets: snapTargetTimes(drag.items, drag.groupIds, currentTimeRef.current),
      })
      setSnapGuideTime(moved.guide)
      if (onPatchTimings) onPatchTimings(moved.starts)
      else onPatchInsert?.(drag.id, { start: moved.starts[0]?.start ?? proposed.start, duration: drag.base.duration })
    }

    function onUp() {
      const drag = dragRef.current
      if (!drag) return
      if (!drag.dragging) {
        if (drag.collapseToId) {
          onSelect?.(insertSelection(drag.collapseToId, [drag.collapseToId]))
        }
        const insert = insertsRef.current.find((item) => item.id === drag.collapseToId ?? drag.id)
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
      setSnapGuideTime(null)
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
  }, [onEndInsertGesture, onPatchInsert, onPatchTimings, onSelect, totalDuration])

  const markTrim = useCallback(
    (edge: "in" | "out") => {
      if (!onChangeTrim || !(timelineDuration > 0)) return
      const time = currentTimeRef.current
      const next =
        edge === "in"
          ? markTrimIn(activeTrim, time, timelineDuration)
          : markTrimOut(activeTrim, time, timelineDuration)
      onChangeTrim(next, "discrete")
    },
    [activeTrim, onChangeTrim, timelineDuration],
  )

  const stepFrames = useCallback(
    (frames: number) => {
      if (!(totalDuration > 0)) return
      const player = playerRef.current
      if (player?.isPlaying()) player.pause()
      const frame = stepFrameIndex(currentTimeRef.current, frames, renderFps, totalDuration)
      const time = frame / renderFps
      currentTimeRef.current = time
      setCurrentTime(time)
      player?.seekToFrame(frame)
      const video = videoRef.current
      if (video && videoReadyRef.current) video.currentTime = time
    },
    [totalDuration],
  )

  useEffect(() => {
    if (exporting || !playableUrl || !(totalDuration > 0)) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "," && event.key !== ".") return
      const frames = frameStepKeyAction(event, selection)
      if (frames === null) return
      event.preventDefault()
      stepFrames(frames)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [exporting, playableUrl, selection, stepFrames, totalDuration])

  const splitAtPlayhead = useCallback(() => {
    if (!onSplitSource || !(timelineDuration > 0)) return
    const time = currentTimeRef.current
    if (!canSplitSourceAt(framing, time, timelineDuration)) return
    onSplitSource(time)
  }, [framing, onSplitSource, timelineDuration])

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = trimDragRef.current
      const track = trackRef.current
      if (!drag || !track || !onChangeTrim || !(timelineDuration > 0)) return
      drag.dragging = true
      const time = clientXToTime(event.clientX, track.getBoundingClientRect(), totalDuration)
      const span = trimWindowRef.current
      const next =
        drag.edge === "in"
          ? clampSourceTrim({ start: time, end: span.end }, timelineDuration)
          : clampSourceTrim({ start: span.start, end: time }, timelineDuration)
      onChangeTrim(next, "gesture")
      const shown = drag.edge === "in" ? (next?.start ?? 0) : (next?.end ?? timelineDuration)
      currentTimeRef.current = shown
      setCurrentTime(shown)
      playerRef.current?.seekToFrame(Math.round(shown * renderFps))
    }

    function onUp() {
      if (!trimDragRef.current) return
      trimDragRef.current = null
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
  }, [onChangeTrim, onEndInsertGesture, timelineDuration, totalDuration])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = timelineSelectionKey(event, isTimelineOrPreviewTarget(event.target))
      if (!action) return
      const ids = selectedIdsOf(selection)
      if (action === "select-all") {
        const next = selectAllItems(selectableItems(insertsRef.current), insertIdOf(selection))
        if (!next.primaryId) return
        event.preventDefault()
        onSelect?.(insertSelection(next.primaryId, next.ids))
        return
      }
      if (ids.length === 0) return
      if (action === "delete") return
      if (action === "duplicate") {
        event.preventDefault()
        onDuplicateSelection?.(ids)
        return
      }
      if (typeof action === "object") {
        event.preventDefault()
        onNudgeSelection?.(ids, action.nudge)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onDuplicateSelection, onNudgeSelection, onSelect, selection])

  async function togglePlay() {
    const player = playerRef.current
    if (player) {
      if (player.isPlaying()) {
        player.pause()
        return
      }
      if (currentTime < trimWindow.start || currentTime >= trimWindow.end - 0.05) {
        seekTo(trimWindow.start)
      }
      player.play()
      return
    }
    setCurrentTime((t) => (t >= trimWindow.end ? trimWindow.start : t))
    setPlaying((p) => !p)
  }

  function reset() {
    setPlaying(false)
    seekTo(trimWindow.start)
    playerRef.current?.pause()
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = trimWindow.start
    }
  }

  /** Leva o playhead até o insert quando ele não aparece no instante atual. */
  function revealInsert(insert: Insert) {
    const time = currentTimeRef.current
    if (time >= insert.start && time < insert.start + insert.duration) return
    seekTo(insert.start)
  }

  function handleShortcut(event: KeyboardEvent) {
    const action = editorShortcutAction(event)
    if (!action || action === "help" || action === "toggle-play" || action === "seek-start" || action === "seek-end") {
      return
    }
    if (exporting || shortcutHelpOpen) return
    switch (action) {
      case "seek-back":
      case "seek-forward":
        if (!(totalDuration > 0)) return
        event.preventDefault()
        seekTo(currentTimeRef.current + (action === "seek-back" ? -JKL_SEEK_SECONDS : JKL_SEEK_SECONDS))
        return
      case "deselect":
        if (!selection || !onSelect) return
        event.preventDefault()
        onSelect(null)
        return
      case "edit-text": {
        if (!selectedInsert || !onEditingTextId) return
        const kind = insertKind(selectedInsert)
        if (kind !== "text" && kind !== "caption") return
        event.preventDefault()
        revealInsert(selectedInsert)
        onEditingTextId(selectedInsert.id)
        return
      }
      case "next-insert":
      case "previous-insert": {
        if (!onSelect || inserts.length === 0) return
        event.preventDefault()
        const ordered = [...inserts].sort((a, b) => a.start - b.start)
        const index = ordered.findIndex((insert) => insert.id === selectedInsertId)
        const next = ordered[cycleIndex(index, ordered.length, action === "next-insert" ? 1 : -1)]
        if (!next) return
        onSelect({ kind: "insert", id: next.id })
        revealInsert(next)
        return
      }
    }
  }
  const shortcutHandlerRef = useRef(handleShortcut)
  shortcutHandlerRef.current = handleShortcut

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => shortcutHandlerRef.current(event)
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEditorShortcuts({
    blocked: exporting || shortcutHelpOpen || suspendShortcuts,
    onHelp: () => setShortcutHelpOpen((open) => !open),
    onTogglePlay: () => {
      if (exporting || !playableUrl) return false
      void togglePlay()
    },
    onSplit: () => {
      if (exporting || !playableUrl) return false
      splitAtPlayhead()
    },
    onMarkIn: () => {
      if (exporting || !playableUrl) return false
      markTrim("in")
    },
    onMarkOut: () => {
      if (exporting || !playableUrl) return false
      markTrim("out")
    },
    onStepFrames: (frames) => {
      if (exporting || !playableUrl || !(totalDuration > 0)) return false
      stepFrames(frames)
    },
    onSeekSeconds: (delta) => {
      if (exporting || !(totalDuration > 0)) return false
      pauseForScrub()
      seekTo(currentTimeRef.current + delta)
    },
    onSeekStart: () => {
      if (exporting || !(totalDuration > 0)) return false
      pauseForScrub()
      seekTo(trimWindow.start)
    },
    onSeekEnd: () => {
      if (exporting || !(totalDuration > 0)) return false
      pauseForScrub()
      seekTo(trimWindow.end)
    },
    onDeleteSelection: () => {
      const ids = selectedIdsOf(selection)
      if (ids.length === 0) return false
      if (onDeleteSelection) onDeleteSelection(ids)
      else if (ids[0]) onRemoveInsert?.(ids[0])
    },
    onUndo: () => {
      if (exporting) return false
      onUndo?.()
    },
    onRedo: () => {
      if (exporting) return false
      onRedo?.()
    },
    onExport: () => {
      onOpenExport?.()
    },
  })

  const onTimelineClipPointerDown = useCallback(
    (event: React.PointerEvent, insert: Insert, handle: TimelineHandle) => {
      if (event.button !== 0 || exporting) return
      event.preventDefault()
      event.stopPropagation()
      const track = trackRef.current
      if (!track) return
      const time = clientXToTime(event.clientX, track.getBoundingClientRect(), totalDuration)
      const items = selectableItems(insertsRef.current)
      const currentIds = selectedIdsOf(selection)
      const additive = event.ctrlKey || event.metaKey
      const range = event.shiftKey
      if (additive || range) {
        const next = nextClickSelection(
          { ids: currentIds, primaryId: insertIdOf(selection) },
          insert.id,
          items,
          { additive, range },
        )
        onSelect?.(next.primaryId ? insertSelection(next.primaryId, next.ids) : null)
        return
      }
      const already = currentIds.includes(insert.id)
      const groupIds = already ? currentIds : [insert.id]
      const trimOne = (handle === "in" || handle === "out") && groupIds.length === 1
      if (!already) onSelect?.(insertSelection(insert.id, [insert.id]))
      onBeginInsertGesture?.()
      dragRef.current = {
        id: insert.id,
        mode: trimOne ? handle : "move",
        grabOffset: time - insert.start,
        base: { start: insert.start, duration: insert.duration },
        originX: event.clientX,
        dragging: false,
        groupIds,
        collapseToId: already && groupIds.length > 1 ? insert.id : null,
        items,
      }
    },
    [exporting, onBeginInsertGesture, onSelect, selection, totalDuration],
  )

  const onTimelineTrimPointerDown = useCallback(
    (_event: React.PointerEvent, edge: "in" | "out") => {
      onBeginInsertGesture?.()
      trimDragRef.current = { edge, dragging: false }
    },
    [onBeginInsertGesture],
  )

  const overlayOptions: { id: OverlayModeId; label: string; icon: typeof Crop }[] = [
    { id: "none", label: "Limpo", icon: MonitorPlay },
    { id: "safe", label: "Safe area", icon: Crop },
    { id: "feed", label: "Feed", icon: LayoutGrid },
  ]
  const editingInsert = editingTextId
    ? (inserts.find((insert) => insert.id === editingTextId) ?? null)
    : null
  const showZoom = Boolean(
    playableUrl && !videoError && sourceWidth > 0 && sourceHeight > 0 && patchActiveSourceTransform,
  )
  const frameTimecode = `${formatTimecode(currentTime, renderFps, "frame")} / ${formatTimecode(totalDuration, renderFps, "frame")}`
  const shownTimecode = shiftHeld
    ? frameTimecode
    : `${formatTimecode(currentTime, renderFps)} / ${formatTimecode(totalDuration, renderFps)}`

  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.key === "Shift") setShiftHeld(true)
    }
    function up(event: KeyboardEvent) {
      if (event.key === "Shift") setShiftHeld(false)
    }
    function blur() {
      setShiftHeld(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const left = leftRailRef.current?.offsetWidth ?? 0
      const right = rightRailRef.current?.offsetWidth ?? 0
      const styles = getComputedStyle(stage)
      const gapX = Number.parseFloat(styles.columnGap) || 0
      const gapsX = gapX * 2
      const next = fitPreviewFrame(
        stage.clientWidth - left - right - gapsX,
        stage.clientHeight,
      )
      setFramePx((prev) => (prev.width === next.width && prev.height === next.height ? prev : next))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    for (const node of [leftRailRef.current, rightRailRef.current, chromeRef.current]) {
      if (node) observer.observe(node)
    }
    measure()
    return () => observer.disconnect()
  }, [showZoom, editingInsert, comboPreviewLabel])

  return (
    <section className="flex h-full min-h-0 flex-col bg-muted/30">
      {/* Top bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MonitorPlay className="size-4" />
          <span className="hidden font-medium text-foreground md:inline">Pré-visualização</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex items-center rounded-full border border-border p-0.5" role="group" aria-label="Sobrepor export">
              <button
                type="button"
                aria-pressed={exportCompare !== "off"}
                onClick={() => setExportCompare((mode) => (mode === "off" ? "half" : "off"))}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  exportCompare !== "off" ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sobrepor export
              </button>
              {exportCompare !== "off" ? (
                <>
                  <button
                    type="button"
                    aria-pressed={exportCompare === "half"}
                    onClick={() => setExportCompare("half")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      exportCompare === "half" ? "bg-brand text-brand-foreground" : "text-muted-foreground",
                    )}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    aria-pressed={exportCompare === "diff"}
                    onClick={() => setExportCompare("diff")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      exportCompare === "diff" ? "bg-brand text-brand-foreground" : "text-muted-foreground",
                    )}
                  >
                    Diferença
                  </button>
                </>
              ) : null}
            </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground 2xl:flex">
            <Smartphone className="size-3.5" />
            9:16
          </div>
          <ThemeToggle />
          {headerActions ? (
            <>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              {headerActions}
            </>
          ) : null}
        </div>
      </div>

      {/* Stage: o frame 9:16 ocupa a altura entre o topo e a timeline. */}
      <div className="flex min-h-0 flex-1 flex-col px-2">
        <div
          ref={chromeRef}
          className="relative z-40 w-full shrink-0"
          style={{ height: STYLE_BAR_SLOT_PX }}
        >
          <div
            ref={setFloatingBarHost}
            data-floating-bar-host
            className="absolute inset-0 flex items-center justify-center overflow-visible"
          >
            {editingInsert ? (
              <TextCommitBar
                insert={editingInsert}
                onApply={() => onEditingTextId?.(null)}
                onCancel={() => onCancelTextEdit?.()}
              />
            ) : null}
            {!editingInsert && comboPreviewLabel ? (
              <div className="flex max-w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-card-foreground shadow-lg">
                <span className="min-w-0 truncate">{comboPreviewLabel}</span>
                <span className="flex shrink-0 gap-1">
                  {comboConfirming ? (
                    <>
                      <Button type="button" size="xs" variant="outline" onClick={() => onConfirmComboPreview?.("add")}>
                        Adicionar aos atuais
                      </Button>
                      <Button type="button" size="xs" onClick={() => onConfirmComboPreview?.("replace")}>
                        Substituir
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="xs" onClick={onApplyComboPreview}>
                      Aplicar
                    </Button>
                  )}
                  <Button type="button" size="xs" variant="ghost" onClick={onCancelComboPreview}>
                    Cancelar
                  </Button>
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div
          ref={stageRef}
          className="grid min-h-0 w-full flex-1 items-center justify-center gap-x-2 overflow-hidden"
          style={{ gridTemplateColumns: "1.5rem auto auto" }}
        >
          <div ref={leftRailRef} className="col-start-1 row-start-1 flex w-6 items-center justify-center">
          {selectedText ? (
            <label className="flex flex-col items-center justify-center gap-2 text-[0.65rem] text-muted-foreground">
              <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">Tamanho</span>
              <input
                type="range"
                min={INSERT_SIZE_PERCENT_MIN}
                max={INSERT_SIZE_PERCENT_MAX}
                step={5}
                value={sizePercentOf(selectedText)}
                aria-label="Tamanho do texto"
                className="h-40 w-6 cursor-pointer accent-sky-400"
                style={{ writingMode: "vertical-lr", direction: "rtl" }}
                onPointerDown={() => onBeginInsertGesture?.()}
                onPointerUp={() => onEndInsertGesture?.()}
                onChange={(event) =>
                  onPatchInsert?.(selectedText.id, insertWithSize(selectedText, Number(event.target.value)))
                }
              />
              <span className="font-mono text-[0.65rem] tabular-nums text-zinc-300">
                {sizePercentOf(selectedText)}%
              </span>
            </label>
          ) : null}
          </div>
        <div
          data-preview-frame
          className="relative col-start-2 row-start-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/50"
          style={{ width: framePx.width, height: framePx.height }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("application/x-editor-element")) return
            event.preventDefault()
          }}
          onDrop={(event) => {
            const type = event.dataTransfer.getData("application/x-editor-element")
            if (!type || !onDropElement) return
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            const x = ((event.clientX - rect.left) / rect.width) * 100
            const y = ((event.clientY - rect.top) / rect.height) * 100
            onDropElement(type as InsertType, x, y)
          }}
        >
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
            <PanelErrorBoundary
              variant="preview"
              resetKey={renderProps.audio?.tracks.map((track) => `${track.id}:${track.trimIn}:${track.trimOut}:${track.duration}`).join("|") ?? ""}
            >
              <PreviewPlayer
                ref={playerRef}
                renderProps={renderProps}
                onFrame={onPlayerFrame}
                onPlayingChange={onPlayerPlayingChange}
              />
            </PanelErrorBoundary>
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
                    TikTok, Instagram, Pinterest, X, Shopee Video ou o catálogo
                    do Mac Mini).
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
            sourceTransform={activeSourceTransform}
            watermark={watermark}
            // Preview player freezes inserts while paused; this canvas redraws on inserts/time.
            paintVisual
            tracks={tracks}
            productData={productData}
            brandKitId={brandKitId}
            project={styleRef ? { styleRef } : {}}
            videoDuration={totalDuration}
            trimStart={trimWindow.start}
            customPresets={customPresets ? Object.values(customPresets) : undefined}
            onSelect={onSelect}
            onPatchInsert={onPatchInsert}
            onPatchCaptionStyle={onPatchCaptionStyle}
            onPatchSourceTransform={patchActiveSourceTransform}
            onSourceFramingActive={setSourceFramingActive}
            onResetSourceTransform={resetActiveSourceTransform}
            onBeginInsertGesture={onBeginInsertGesture}
            onEndInsertGesture={onEndInsertGesture}
            onCreateTextAt={onCreateTextAt}
            onDuplicateInsert={onDuplicateInsert}
            editingTextId={editingTextId}
            onEditingTextId={onEditingTextId}
            onCancelTextEdit={onCancelTextEdit}
            onSamplePlayColor={samplePlayColor}
            floatingBarContainer={floatingBarHost}
            onOpenAdvanced={() => {
              const id = selectedText?.id
              if (!id) return
              const card = document.querySelector(`[data-insert-card][data-insert-id="${CSS.escape(id)}"]`)
              if (card instanceof HTMLElement) scrollIntoPanelViewport(card)
            }}
          />

          <ExportCompareLayer
            mode={exportCompare}
            time={currentTime}
            inserts={inserts}
            fontId={fontId}
            logoSrc={logoSrc}
            blobUrls={stickerBlobUrls}
            captionPreset={captionPreset}
            captionStyle={captionStyle ?? DEFAULT_CAPTION_STYLE}
            tracks={tracks}
            styleRef={styleRef}
            productData={productData}
            brandKitId={brandKitId}
            videoDuration={totalDuration}
            customPresets={customPresets ? Object.values(customPresets) : undefined}
            watermark={watermark}
          />

          {/* Overlays */}
          {(overlay === "safe" || sourceFramingActive) && <SafeAreaOverlay />}
          {overlay === "feed" && <FeedMockup />}
        </div>
          <div ref={rightRailRef} className="col-start-3 row-start-1 flex items-center justify-center">
          {showZoom && patchActiveSourceTransform ? (
            <SourceZoomSlider
              sourceTransform={activeSourceTransform}
              sourceWidth={sourceWidth}
              sourceHeight={sourceHeight}
              segmentLabel={
                segments.length > 1
                  ? `Trecho ${activeSegmentIndex + 1}/${segments.length}`
                  : undefined
              }
              onPatchSourceTransform={patchActiveSourceTransform}
              onBeginGesture={onBeginInsertGesture}
              onEndGesture={onEndInsertGesture}
            />
          ) : null}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="shrink-0 border-t border-border bg-card px-3 py-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              onClick={togglePlay}
              disabled={exporting || !playableUrl}
              aria-label={playing ? "Pausar" : "Reproduzir"}
              aria-keyshortcuts="K Space"
              title={`${playing ? "Pausar" : "Reproduzir"} (K ou Espaço)`}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={reset}
              aria-label="Reiniciar"
              aria-keyshortcuts="Home"
              title="Voltar ao início (Home)"
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
                title="Marcadores de retenção"
              >
                <Target />
              </Button>
            ) : null}
          </div>

          {selectedIdsOf(selection).length >= 2 ? (
            <div className="flex shrink-0 items-center gap-1" role="status">
              <span className="text-xs text-foreground">
                {selectedIdsOf(selection).length} selecionados
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={exporting}
                onClick={() => onDuplicateSelection?.(selectedIdsOf(selection))}
              >
                Duplicar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={exporting}
                onClick={() => onDeleteSelection?.(selectedIdsOf(selection))}
              >
                Apagar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Limpar seleção"
                title="Limpar seleção"
                onClick={() => onSelect?.(null)}
              >
                <X />
              </Button>
            </div>
          ) : null}

          <span
            className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
            title={frameTimecode}
          >
            {shownTimecode}
          </span>

          {showTimeline && totalDuration > 0 && onChangeTrim ? (
            <div
              className="flex shrink-0 items-center gap-1"
              role="group"
              aria-label="Corte do vídeo"
            >
              <Button
                variant={activeTrim && activeTrim.start > 0 ? "secondary" : "outline"}
                size="xs"
                disabled={exporting || !playableUrl}
                onClick={() => markTrim("in")}
                aria-keyshortcuts="I"
                title={`Marcar a entrada (I) · ${TRIM_HINT}`}
              >
                <span aria-hidden className="font-mono font-bold">[</span>
                Entrada
              </Button>
              <Button
                variant={activeTrim && activeTrim.end < timelineDuration ? "secondary" : "outline"}
                size="xs"
                disabled={exporting || !playableUrl}
                onClick={() => markTrim("out")}
                aria-keyshortcuts="O"
                title={`Marcar a saída (O) · ${TRIM_HINT}`}
              >
                Saída
                <span aria-hidden className="font-mono font-bold">]</span>
              </Button>
              {activeTrim ? (
                <>
                  <span className="px-1 font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                    {formatTime(trimWindow.duration)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={exporting}
                    onClick={() => onChangeTrim(null, "discrete")}
                    aria-label="Remover corte"
                    title="Remover corte"
                  >
                    <X />
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {showTimeline && totalDuration > 0 && onSplitSource ? (
            <Button
              variant="outline"
              size="xs"
              className="shrink-0"
              disabled={exporting || !playableUrl || !canSplitHere}
              onClick={splitAtPlayhead}
              aria-keyshortcuts="S"
              title={`Dividir (S) · ${SPLIT_HINT}`}
            >
              <Scissors />
              Dividir
            </Button>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {showTimeline && totalDuration > 0 ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setTimelineZoom((zoom) => Math.max(TIMELINE_ZOOM_MIN, zoom / 1.5))}
                  disabled={timelineZoom <= TIMELINE_ZOOM_MIN}
                  aria-label="Diminuir zoom da linha do tempo"
                  title="Diminuir zoom (Ctrl + rolar)"
                >
                  <ZoomOut />
                </Button>
                <button
                  type="button"
                  className="w-10 rounded px-1 text-center font-mono text-[0.7rem] tabular-nums text-muted-foreground hover:text-foreground"
                  onClick={() => setTimelineZoom(TIMELINE_ZOOM_MIN)}
                  title="Zoom da linha do tempo · clique para ver tudo"
                  aria-label="Ver a linha do tempo inteira"
                >
                  {timelineZoom.toFixed(1)}×
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setTimelineZoom((zoom) => clampTimelineZoom(zoom * 1.5))}
                  disabled={timelineZoom >= TIMELINE_ZOOM_MAX}
                  aria-label="Aumentar zoom da linha do tempo"
                  title="Aumentar zoom (Ctrl + rolar)"
                >
                  <ZoomIn />
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShortcutHelpOpen(true)}
              aria-label="Atalhos de teclado"
              aria-keyshortcuts="?"
              title="Atalhos de teclado (?)"
            >
              <Keyboard />
            </Button>
          </div>
        </div>

        {showTimeline && totalDuration > 0 ? (
          <div className="mt-2">
            <EditorTimeline
              totalDuration={totalDuration}
              currentTime={currentTime}
              playing={playing}
              inserts={inserts}
              selectedInsertId={typeof selectedInsertId === "string" ? selectedInsertId : null}
              pendingInsertId={
                editingInsert && insertKind(editingInsert) === "text" ? editingInsert.id : null
              }
              selectedIds={selectedIdsOf(selection)}
              snapGuideTime={snapGuideTime}
              onChangeSelection={(ids, primaryId) => {
                onSelect?.(primaryId ? insertSelection(primaryId, ids) : null)
              }}
              onSelectionCommand={(command, ids, primaryId) => {
                if (command === "duplicate") onDuplicateSelection?.(ids)
                else if (command === "delete") onDeleteSelection?.(ids)
                else if (command === "align") onAlignSelection?.(primaryId, ids)
                else {
                  const items = selectableItems(inserts)
                  const track = items.find((item) => item.id === primaryId)?.track
                  if (!track) return
                  onSelect?.(insertSelection(primaryId, idsOnTrack(items, track)))
                }
              }}
              exporting={exporting}
              showRetention={showRetention}
              retentionCuts={retentionCuts}
              segments={segments}
              activeSegmentIndex={activeSegmentIndex}
              sourceCuts={sourceCuts}
              onRemoveSourceCut={onRemoveSourceCut}
              audioTracks={audio?.tracks ?? []}
              audioPeaks={audioPeaks}
              sourcePeaks={sourcePeaks}
              sourceAudioDim={
                (audio?.original.muted ?? false) || (audio?.original.volume ?? 1) < 0.2
              }
              selectedAudioId={selectedAudioId}
              onSelectAudio={onSelectAudio}
              onAudioEdit={onAudioEdit}
              trimWindow={trimWindow}
              hasTrim={Boolean(activeTrim)}
              canDragTrim={Boolean(onChangeTrim)}
              contentRef={trackRef}
              zoom={timelineZoom}
              onZoomChange={setTimelineZoom}
              onSeek={seekTo}
              onScrubStart={pauseForScrub}
              onTrimPointerDown={onTimelineTrimPointerDown}
              onClipPointerDown={onTimelineClipPointerDown}
              motionById={motionById}
              onEmphasisMove={(id, index, atFrame) => {
                if (!onPatchInsertStyle) return
                const insert = insertsRef.current.find((item) => item.id === id)
                if (!insert) return
                const track = trackStyleForInsert(insert, tracks, totalDurationRef.current)
                const resolved = resolveStyleForEditor(insert, track, { styleRef })
                onPatchInsertStyle(id, "animation", moveEmphasis(resolved.animation, index, atFrame))
              }}
              onEmphasisGesture={(phase) => {
                if (phase === "start") onBeginInsertGesture?.()
                else onEndInsertGesture?.()
              }}
            />
          </div>
        ) : null}
      </div>

      <ShortcutHelpDialog open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />
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
