"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { SelectionOverlay, type ResizeCorner, type ResizeEdge } from "@/components/selection-overlay"
import { ElementFloatingBar } from "@/components/element-floating-bar"
import { TextFloatingBar } from "@/components/text-floating-bar"
import { TextInlineEditor } from "@/components/text-inline-editor"
import { snapMoveWithGuides } from "@/lib/canvas/guides"
import { nudgeTextPercents } from "@/lib/canvas/coords"
import { isDuplicateInsertKey, snapRotationDegrees } from "@/lib/canvas/keys"
import { percentsFromCenter, playToClient } from "@/lib/compose/layout"
import { drawPlayInserts } from "@/lib/compose/draw-play"
import { ensureComposeFontsReady, fontIdsUsedInComposition } from "@/lib/compose/fonts"
import { approxBox, hitTestOverlays, resizePatchForTrack, scaleFactorFromDrag } from "@/lib/compose/hit-test"
import { canHandlePreviewNudge } from "@/lib/compose/keyboard-scope"
import {
  PLAY_H,
  PLAY_W,
  SNAP_SCREEN_PX,
  clientToPlay,
  getCanvasDisplayMetrics,
  type CanvasDisplayMetrics,
  type RectLike,
} from "@/lib/compose/layout"
import { canvasTextMeasure, layoutInsertText, type TextLayout } from "@/lib/compose/layout-text"
import {
  fallbackTextLayout,
  inlineEditorCss,
  inlineEditorPlacement,
  paintedDisplayInsert,
  paintedTextStyleFor,
} from "@/lib/compose/inline-editor-style"
import {
  angleDegFromCenter,
  localPoint,
  maxWidthPctFromEdgeDrag,
  rotationFromDrag,
} from "@/lib/compose/preview-handles"
import { nudgePercents, patchForMove } from "@/lib/compose/preview-snap"
import {
  applyFontFamily,
  applyTextBackground,
  applyTextPreset,
  applyTextShadow,
  getTextPreset,
  isTextPresetId,
  nudgeTextRadius,
  TEXT_PRESET_FONT_FILES,
  textBackgroundEnabledOf,
  textRadiusOf,
  textShadowEnabledOf,
} from "@/lib/text-presets"
import { resolveLayerStyle } from "@/lib/compose/resolve-style"
import { stickerMediaSrc } from "@/lib/compose/sticker-src"
import { layoutOverlayInsertForPlay } from "@/lib/compose/caption-layout"
import { chipHasFreePosition, chipPlayBox, layoutInserts } from "@/lib/insert-layout"
import { trackStyleForInsert } from "@/lib/style-preset"
import type { StyleLayer, TrackId, UserPreset } from "@/lib/style/types"
import {
  DEFAULT_CAPTION_STYLE,
  DEFAULT_FPS,
  DEFAULT_MAX_WIDTH_PCT,
  insertKind,
  isChipInsert,
  type CaptionPreset,
  type CaptionStyle,
  type CompositionInsert,
} from "@/lib/composition"
import {
  applyElementColors,
  applyElementText,
  elementColorsOf,
  elementMaxWidthPctOf,
  elementScaleOf,
  elementTextOf,
  getElementPreset,
  nudgeElementMaxWidth,
  nudgeElementScale,
  wrapsElementText,
} from "@/lib/elements"
import { insertIdOf, isSourceSelected, type PreviewSelection } from "@/lib/preview-selection"
import { getVideoRect, type CoverRect } from "@/lib/export/cover"
import {
  nudgeSourceTransform,
  panSourceTransform,
  scaleSourceTransformAt,
  sourceTransformOrDefault,
  type SourceTransform,
} from "@/lib/source-transform"
import type { WatermarkPaint } from "@/lib/watermark"

const FRAME = { width: 1080, height: 1920 }

let editorMeasureContext: CanvasRenderingContext2D | null = null

/** Contexto 2D fora da tela só para medir texto; criado uma vez e reaproveitado. */
function getEditorMeasureContext(): CanvasRenderingContext2D | null {
  editorMeasureContext ??= document.createElement("canvas").getContext("2d")
  return editorMeasureContext
}

type DragState =
  | { mode: "move"; id: string }
  | {
      mode: "resize"
      id: string
      center: { x: number; y: number }
      startDist: number
      base: CompositionInsert
    }
  | {
      mode: "rotate"
      id: string
      center: { x: number; y: number }
      startRotation: number
      startPointerDeg: number
      base: CompositionInsert
    }
  | {
      mode: "ew"
      id: string
      edge: ResizeEdge
      center: { x: number; y: number }
      startWidthPct: number
      startLocalX: number
      rotationDeg: number
      base: CompositionInsert
    }
  | {
      mode: "source-pan"
      startPlay: { x: number; y: number }
      base: SourceTransform
      axis: "x" | "y" | null
      last: SourceTransform
    }
  | {
      mode: "source-resize"
      corner: ResizeCorner
      pivot: { x: number; y: number }
      startDist: number
      centerDist: number
      base: SourceTransform
      last: SourceTransform
    }

const OPPOSITE_CORNER: Record<ResizeCorner, ResizeCorner> = {
  nw: "se",
  ne: "sw",
  sw: "ne",
  se: "nw",
}

function pointerInPlay(
  clientX: number,
  clientY: number,
  metrics: CanvasDisplayMetrics,
): { x: number; y: number } | null {
  if (!(metrics.displayScale > 0)) return null
  return {
    x: (clientX - metrics.ox) / metrics.displayScale,
    y: (clientY - metrics.oy) / metrics.displayScale,
  }
}

function videoCorner(rect: CoverRect, corner: ResizeCorner): { x: number; y: number } {
  const right = rect.dx + rect.dw
  const bottom = rect.dy + rect.dh
  if (corner === "nw") return { x: rect.dx, y: rect.dy }
  if (corner === "ne") return { x: right, y: rect.dy }
  if (corner === "sw") return { x: rect.dx, y: bottom }
  return { x: right, y: bottom }
}

function applySourceFramingDom(
  host: HTMLElement,
  framing: SourceTransform,
  sourceWidth: number,
  sourceHeight: number,
) {
  const el = host.parentElement?.querySelector("[data-source-framing]")
  if (!(el instanceof HTMLElement)) return
  const rect = getVideoRect(framing, sourceWidth, sourceHeight, PLAY_W, PLAY_H)
  el.style.left = `${rect.dx}px`
  el.style.top = `${rect.dy}px`
  el.style.width = `${rect.dw}px`
  el.style.height = `${rect.dh}px`
}

function isActive(insert: CompositionInsert, time: number): boolean {
  return time >= insert.start && time < insert.start + insert.duration
}

function layoutOverlayInsert(
  insert: CompositionInsert,
  captionStyle: CaptionStyle,
  captionPreset: CaptionPreset,
  tracks: Partial<Record<TrackId, StyleLayer>> | undefined,
  project: StyleLayer,
  videoDuration: number,
): CompositionInsert {
  const track =
    videoDuration > 0 ? trackStyleForInsert(insert, tracks, videoDuration) : null
  return layoutOverlayInsertForPlay(insert, captionStyle, captionPreset, track, project ?? {})
}

export function OverlayCanvas({
  inserts,
  time,
  fontId,
  fontFamily,
  logoSrc = "",
  blobUrls = {},
  captionPreset = "viral",
  captionStyle = DEFAULT_CAPTION_STYLE,
  selection = null,
  sourceWidth = 0,
  sourceHeight = 0,
  sourceTransform,
  paintVisual = true,
  tracks,
  project,
  videoDuration = 0,
  customPresets,
  watermark,
  onSelect,
  onPatchInsert,
  onPatchCaptionStyle,
  onPatchSourceTransform,
  onSourceFramingActive,
  onResetSourceTransform,
  onBeginInsertGesture,
  onEndInsertGesture,
  onCreateTextAt,
  onDuplicateInsert,
  editingTextId = null,
  onEditingTextId,
  onCancelTextEdit,
  onSamplePlayColor,
  onOpenAdvanced,
  floatingBarContainer = null,
}: {
  inserts: CompositionInsert[]
  time: number
  fontId: string
  fontFamily: string
  logoSrc?: string
  blobUrls?: Record<string, string>
  captionPreset?: CaptionPreset
  captionStyle?: CaptionStyle
  selection?: PreviewSelection
  sourceWidth?: number
  sourceHeight?: number
  sourceTransform?: SourceTransform
  tracks?: Partial<Record<TrackId, StyleLayer>>
  project?: StyleLayer
  videoDuration?: number
  customPresets?: UserPreset[]
  watermark?: WatermarkPaint | null
  /** When false, only hit-testing/selection run — Remotion paints the inserts. */
  paintVisual?: boolean
  onSelect?: (selection: PreviewSelection) => void
  onPatchInsert?: (id: string, patch: Partial<CompositionInsert>) => void
  onPatchCaptionStyle?: (patch: Partial<CaptionStyle>) => void
  onPatchSourceTransform?: (transform: SourceTransform) => void
  onSourceFramingActive?: (active: boolean) => void
  onResetSourceTransform?: () => void
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
  onCreateTextAt?: (x: number, y: number) => void
  onDuplicateInsert?: (id: string) => void
  editingTextId?: string | null
  /** `id` abre o editor inline; `null` confirma a edição em andamento. */
  onEditingTextId?: (id: string | null) => void
  /** Esc no editor inline: volta ao texto original sem deixar entrada no desfazer. */
  onCancelTextEdit?: () => void
  onSamplePlayColor?: (playX: number, playY: number) => string | null
  onOpenAdvanced?: (id: string) => void
  /** Onde as barras de estilo aparecem; sem ele, ficam por cima do vídeo. */
  floatingBarContainer?: HTMLElement | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const insertsRef = useRef(inserts)
  const captionStyleRef = useRef(captionStyle)
  const tracksRef = useRef(tracks)
  const projectRef = useRef(project ?? {})
  const videoDurationRef = useRef(videoDuration)
  const [imageTick, setImageTick] = useState(0)
  const [hostRect, setHostRect] = useState<DOMRect | null>(null)
  const [textLayouts, setTextLayouts] = useState<ReadonlyMap<string, TextLayout>>(new Map())
  const imagesRef = useRef(new Map<string, HTMLImageElement>())
  const logoRef = useRef<HTMLImageElement | null>(null)
  const sourceWidthRef = useRef(sourceWidth)
  const sourceHeightRef = useRef(sourceHeight)
  const sourceTransformRef = useRef(sourceTransform)
  const selectionRef = useRef(selection)
  const onPatchSourceTransformRef = useRef(onPatchSourceTransform)
  const onSourceFramingActiveRef = useRef(onSourceFramingActive)
  const onBeginInsertGestureRef = useRef(onBeginInsertGesture)
  const onEndInsertGestureRef = useRef(onEndInsertGesture)
  const onSelectRef = useRef(onSelect)
  const liveFramingRef = useRef<SourceTransform | null>(null)
  const framingRafRef = useRef<number | null>(null)
  const wheelCommitTimerRef = useRef<number | null>(null)
  const wheelActiveRef = useRef(false)
  const [liveFraming, setLiveFraming] = useState<SourceTransform | null>(null)
  const [moveGuides, setMoveGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  })
  const [samplingColor, setSamplingColor] = useState(false)
  const hasLayer = inserts.length > 0 || Boolean(watermark)
  const selectedInsertId = insertIdOf(selection)

  insertsRef.current = inserts
  captionStyleRef.current = captionStyle
  tracksRef.current = tracks
  projectRef.current = project ?? {}
  videoDurationRef.current = videoDuration
  sourceWidthRef.current = sourceWidth
  sourceHeightRef.current = sourceHeight
  sourceTransformRef.current = sourceTransform
  selectionRef.current = selection
  onPatchSourceTransformRef.current = onPatchSourceTransform
  onSourceFramingActiveRef.current = onSourceFramingActive
  onBeginInsertGestureRef.current = onBeginInsertGesture
  onEndInsertGestureRef.current = onEndInsertGesture
  onSelectRef.current = onSelect

  function flushFramingFrame() {
    framingRafRef.current = null
    const framing = liveFramingRef.current
    const host = hostRef.current
    if (!framing || !host) return
    applySourceFramingDom(host, framing, sourceWidthRef.current, sourceHeightRef.current)
    setLiveFraming(framing)
  }

  function queueLiveFraming(next: SourceTransform) {
    liveFramingRef.current = next
    if (framingRafRef.current != null) return
    framingRafRef.current = window.requestAnimationFrame(flushFramingFrame)
  }

  function commitLiveFraming(next: SourceTransform | null = liveFramingRef.current) {
    if (framingRafRef.current != null) {
      window.cancelAnimationFrame(framingRafRef.current)
      framingRafRef.current = null
    }
    if (next) {
      const host = hostRef.current
      if (host) applySourceFramingDom(host, next, sourceWidthRef.current, sourceHeightRef.current)
      onPatchSourceTransformRef.current?.(next)
    }
    liveFramingRef.current = null
    setLiveFraming(null)
  }

  const framingOpsRef = useRef({ queueLiveFraming, commitLiveFraming })
  framingOpsRef.current = { queueLiveFraming, commitLiveFraming }

  useEffect(() => {
    for (const insert of inserts) {
      if (insertKind(insert) !== "sticker") continue
      const src = stickerMediaSrc(insert, blobUrls)
      if (!src || imagesRef.current.has(insert.id)) continue
      const image = new Image()
      image.onload = () => setImageTick((tick) => tick + 1)
      image.onerror = () => {
        console.error("[editor] falha ao carregar insert PNG")
      }
      image.src = src
      imagesRef.current.set(insert.id, image)
    }
  }, [blobUrls, inserts])

  useEffect(() => {
    if (!logoSrc) {
      logoRef.current = null
      return
    }
    const image = new Image()
    image.onload = () => setImageTick((tick) => tick + 1)
    image.onerror = () => {
      console.error("[editor] falha ao carregar logo do chip")
    }
    image.src = logoSrc
    logoRef.current = image
  }, [logoSrc])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!hasLayer) {
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    canvas.width = FRAME.width
    canvas.height = FRAME.height
    let cancelled = false
    void (async () => {
      await ensureComposeFontsReady([
        ...fontIdsUsedInComposition({
          brand: { fontId },
          inserts,
          captionStyle,
          styleRef: project?.styleRef,
          tracks,
          customPresets: customPresets
            ? Object.fromEntries(customPresets.map((preset) => [preset.id, preset]))
            : undefined,
        }),
        ...(watermark?.text ? ["geist"] : []),
      ])
      if (cancelled) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, FRAME.width, FRAME.height)
      // Also runs while paused: inserts and scrub time are effect deps, not only the play loop.
      if (paintVisual) {
        drawPlayInserts(
          ctx,
          editingTextId ? inserts.filter((insert) => insert.id !== editingTextId) : inserts,
          time,
          fontId,
          logoSrc,
          imagesRef.current,
          (src) => {
            if (src !== logoSrc) return null
            const logo = logoRef.current
            if (logo && logo.naturalWidth > 0) return logo
            return null
          },
          captionPreset,
          captionStyle,
          { fps: DEFAULT_FPS, videoDuration, project: project ?? {}, tracks, customPresets, editPreview: true },
          watermark ?? null,
        )
      }
      const layouts = new Map<string, TextLayout>()
      for (const insert of inserts) {
        const kind = insertKind(insert)
        if (kind !== "text" && kind !== "caption") continue
        const layoutInsert = layoutOverlayInsert(
          insert,
          captionStyle,
          captionPreset,
          tracks,
          project ?? {},
          videoDuration,
        )
        const style = resolveLayerStyle(layoutInsert, fontId)
        const layout = layoutInsertText(
          layoutInsert,
          fontId,
          FRAME,
          canvasTextMeasure(ctx, style.fontWeight, style.fontFamily),
        )
        if (layout) layouts.set(insert.id, layout)
      }
      if (cancelled) return
      setTextLayouts(layouts)
    })()
    return () => {
      cancelled = true
    }
  }, [captionPreset, captionStyle, customPresets, editingTextId, fontFamily, fontId, hasLayer, imageTick, inserts, logoSrc, paintVisual, project, time, tracks, videoDuration, watermark])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => setHostRect(host.getBoundingClientRect())
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    window.addEventListener("scroll", update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", update, true)
    }
  }, [])

  const naturals = useMemo(() => {
    const map = new Map<string, { width: number; height: number }>()
    for (const [id, image] of imagesRef.current) {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        map.set(id, { width: image.naturalWidth, height: image.naturalHeight })
      }
    }
    return map
  }, [imageTick, inserts])

  const chipLayouts = useMemo(
    () => layoutInserts(inserts, time, FRAME, fontId, logoSrc, {
      videoDuration,
      project: project ?? {},
      tracks,
    }),
    [fontId, inserts, logoSrc, project, time, tracks, videoDuration],
  )
  const chipBoxes = useMemo(() => {
    const map = new Map<string, { cx: number; cy: number; w: number; h: number }>()
    for (const chip of chipLayouts) {
      map.set(chip.id, chipPlayBox(chip))
    }
    return map
  }, [chipLayouts])

  const activeOverlays = useMemo(
    () =>
      inserts
        .filter((insert) => isActive(insert, time))
        .map((insert) =>
          layoutOverlayInsert(
            insert,
            captionStyle,
            captionPreset,
            tracks,
            project ?? {},
            videoDuration,
          ),
        ),
    [captionPreset, captionStyle, inserts, project, time, tracks, videoDuration],
  )

  const selectedInsert =
    inserts.find((insert) => insert.id === selectedInsertId) ?? null
  const selectedVisible = selectedInsert && isActive(selectedInsert, time) ? selectedInsert : null
  const selectedLaidOut = selectedInsert
    ? layoutOverlayInsert(
        selectedInsert,
        captionStyle,
        captionPreset,
        tracks,
        project ?? {},
        videoDuration,
      )
    : null
  const selectedBox = selectedLaidOut
    ? approxBox(
        selectedLaidOut,
        1,
        naturals.get(selectedLaidOut.id),
        chipBoxes.get(selectedLaidOut.id) ?? null,
        fontId,
        undefined,
        textLayouts.get(selectedLaidOut.id) ?? null,
      )
    : null

  const metrics: CanvasDisplayMetrics | null = hostRect
    ? getCanvasDisplayMetrics(hostRect)
    : null
  const hostBox: RectLike | null = hostRect

  const editingInsert = editingTextId
    ? (inserts.find((insert) => insert.id === editingTextId) ?? null)
    : null

  // Só no Enter/Esc: num blur por clique em outro campo, o foco já tem novo dono.
  function restoreStageFocusAfterEditor() {
    if (document.activeElement instanceof HTMLElement && document.activeElement.dataset.textInlineEditor !== undefined) {
      hostRef.current?.focus({ preventScroll: true })
    }
  }
  const editorView = (() => {
    if (!editingInsert || !metrics || !hostBox) return null
    const kind = insertKind(editingInsert)
    if (kind !== "text" && kind !== "caption") return null
    const laid = layoutOverlayInsert(
      editingInsert,
      captionStyle,
      captionPreset,
      tracks,
      project ?? {},
      videoDuration,
    )
    const track =
      videoDuration > 0 ? trackStyleForInsert(editingInsert, tracks, videoDuration) : null
    const painted = paintedTextStyleFor(editingInsert, {
      captionStyle,
      captionPreset,
      track,
      project: project ?? {},
    })
    const display = paintedDisplayInsert({
      insert: editingInsert,
      laidOut: laid,
      painted,
      brandFontId: fontId,
    })
    const measureContext = getEditorMeasureContext()
    const displayLayer = resolveLayerStyle(display, fontId)
    const measured = measureContext
      ? layoutInsertText(
          display,
          fontId,
          FRAME,
          canvasTextMeasure(measureContext, displayLayer.fontWeight, displayLayer.fontFamily),
        )
      : null
    // Texto vazio não gera layout no canvas; sem fallback o editor desmontaria ao apagar tudo.
    const layout = measured ?? fallbackTextLayout(display, fontId)
    return {
      css: inlineEditorCss({
        laidOut: display,
        layout,
        painted,
        brandFontId: fontId,
        scale: metrics.displayScale,
      }),
      placement: inlineEditorPlacement(layout, metrics, hostBox),
    }
  })()

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current
      const host = hostRef.current
      if (!drag || !host) return
      const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
      const play = clientToPlay(event.clientX, event.clientY, display)
      if (drag.mode === "source-pan") {
        const pointer = pointerInPlay(event.clientX, event.clientY, display)
        if (!pointer) return
        let dx = pointer.x - drag.startPlay.x
        let dy = pointer.y - drag.startPlay.y
        if (event.shiftKey) {
          if (!drag.axis) {
            drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y"
          }
          if (drag.axis === "x") dy = 0
          else dx = 0
        } else {
          drag.axis = null
        }
        const next = panSourceTransform(
          drag.base,
          dx,
          dy,
          sourceWidthRef.current,
          sourceHeightRef.current,
          PLAY_W,
          PLAY_H,
          { altKey: event.altKey },
        )
        drag.last = next
        framingOpsRef.current.queueLiveFraming(next)
        return
      }
      if (drag.mode === "source-resize") {
        const pointer = pointerInPlay(event.clientX, event.clientY, display)
        if (!pointer) return
        const pivot = event.altKey
          ? { x: PLAY_W / 2, y: PLAY_H / 2 }
          : drag.pivot
        const startDist = event.altKey ? drag.centerDist : drag.startDist
        const dist = Math.hypot(pointer.x - pivot.x, pointer.y - pivot.y)
        if (!(startDist > 0)) return
        const next = scaleSourceTransformAt(
          drag.base,
          dist / startDist,
          pivot,
          sourceWidthRef.current,
          sourceHeightRef.current,
          PLAY_W,
          PLAY_H,
          { altKey: event.altKey },
        )
        drag.last = next
        framingOpsRef.current.queueLiveFraming(next)
        return
      }
      if (!play.inside) return
      const current = insertsRef.current.find((insert) => insert.id === drag.id)
      if (!current) return

      if (drag.mode === "move") {
        let cx = play.playX
        let cy = play.playY
        if (!event.altKey) {
          const others = insertsRef.current
            .filter((insert) => insert.id !== drag.id && isActive(insert, time))
            .map((insert) =>
              approxBox(
                layoutOverlayInsert(
                  insert,
                  captionStyleRef.current,
                  captionPreset,
                  tracksRef.current,
                  projectRef.current,
                  videoDurationRef.current,
                ),
                display.displayScale,
                naturals.get(insert.id),
                chipBoxes.get(insert.id) ?? null,
                fontId,
                undefined,
                textLayouts.get(insert.id) ?? null,
              ),
            )
            .filter((box): box is NonNullable<typeof box> => box !== null)
          const snapped = snapMoveWithGuides(cx, cy, others, SNAP_SCREEN_PX / display.displayScale)
          cx = snapped.cx
          cy = snapped.cy
          setMoveGuides(snapped.guides)
        } else {
          setMoveGuides({ x: null, y: null })
        }
        const movePatch = patchForMove(cx, cy)
        const laid = layoutOverlayInsert(
          current,
          captionStyleRef.current,
          captionPreset,
          tracksRef.current,
          projectRef.current,
          videoDurationRef.current,
        )
        onPatchInsert?.(drag.id, {
          x: movePatch.x,
          y: movePatch.y,
          rotation: laid.rotation ?? laid.style?.rotation,
          maxWidthPct: laid.maxWidthPct,
          scale: laid.scale,
        })
        return
      }

      const pointer = pointerInPlay(event.clientX, event.clientY, display)
      if (drag.mode === "rotate") {
        if (!pointer) return
        const nowDeg = angleDegFromCenter(drag.center, pointer)
        const rotation = snapRotationDegrees(
          rotationFromDrag(drag.startRotation, drag.startPointerDeg, nowDeg),
          event.shiftKey,
        )
        onPatchInsert?.(drag.id, {
          x: drag.base.x,
          y: drag.base.y,
          rotation,
          maxWidthPct: drag.base.maxWidthPct,
          scale: drag.base.scale,
        })
        return
      }

      if (drag.mode === "ew") {
        if (!pointer) return
        const local = localPoint(drag.center, pointer, drag.rotationDeg)
        const maxWidthPct = maxWidthPctFromEdgeDrag(
          drag.startWidthPct,
          local.x - drag.startLocalX,
          PLAY_W,
          drag.edge,
        )
        onPatchInsert?.(drag.id, {
          x: drag.base.x,
          y: drag.base.y,
          rotation: drag.base.rotation ?? drag.base.style?.rotation,
          maxWidthPct,
          scale: drag.base.scale,
        })
        return
      }

      const factor = scaleFactorFromDrag(
        drag.center,
        { x: play.playX, y: play.playY },
        drag.startDist,
      )
      const sizePatch = resizePatchForTrack(drag.base, factor)
      if (insertKind(drag.base) === "caption") {
        if (typeof sizePatch.fontSize === "number") {
          onPatchCaptionStyle?.({ fontSize: sizePatch.fontSize })
        }
        return
      }
      const placePatch =
        insertKind(drag.base) === "chip" && !chipHasFreePosition(drag.base)
          ? patchForMove(drag.center.x, drag.center.y)
          : {}
      onPatchInsert?.(drag.id, { ...placePatch, ...sizePatch })
    }

    function onUp() {
      const drag = dragRef.current
      setMoveGuides({ x: null, y: null })
      if (!drag) return
      if (drag.mode === "source-pan" || drag.mode === "source-resize") {
        framingOpsRef.current.commitLiveFraming(drag.last)
        onSourceFramingActiveRef.current?.(false)
        dragRef.current = null
        onEndInsertGestureRef.current?.()
        return
      }
      dragRef.current = null
      onEndInsertGestureRef.current?.()
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [captionPreset, chipBoxes, fontId, naturals, onEndInsertGesture, onPatchCaptionStyle, onPatchInsert, onPatchSourceTransform, sourceHeight, sourceWidth, textLayouts, time, tracks, videoDuration])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (editingTextId) return
      if (isDuplicateInsertKey(event) && selectedInsert) {
        event.preventDefault()
        onDuplicateInsert?.(selectedInsert.id)
        return
      }
      if (!canHandlePreviewNudge(event, selection)) return
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown"
      ) {
        return
      }
      if (isSourceSelected(selection)) {
        event.preventDefault()
        event.stopPropagation()
        const current = sourceTransformOrDefault(sourceTransform)
        onPatchSourceTransform?.(
          nudgeSourceTransform(
            current,
            event.key,
            event.shiftKey,
            sourceWidth,
            sourceHeight,
          ),
        )
        return
      }
      if (!selectedInsert) return
      event.preventDefault()
      event.stopPropagation()
      const laid =
        insertKind(selectedInsert) === "caption"
          ? layoutOverlayInsert(
              selectedInsert,
              captionStyle,
              captionPreset,
              tracks,
              project ?? {},
              videoDuration,
            )
          : selectedInsert
      const stacked = chipBoxes.get(selectedInsert.id)
      const current =
        typeof laid.x === "number" && typeof laid.y === "number"
          ? { x: laid.x, y: laid.y }
          : stacked
            ? patchForMove(stacked.cx, stacked.cy)
            : { x: 50, y: 50 }
      const next =
        insertKind(selectedInsert) === "text"
          ? nudgeTextPercents(current, event.key, event.shiftKey)
          : nudgePercents(current, event.key, event.shiftKey)
      onPatchInsert?.(selectedInsert.id, {
        ...next,
        rotation: laid.rotation ?? laid.style?.rotation,
        maxWidthPct: laid.maxWidthPct,
        scale: laid.scale,
      })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [captionPreset, captionStyle, chipBoxes, onPatchCaptionStyle, onPatchInsert, onPatchSourceTransform, project, selectedInsert, selection, sourceHeight, sourceTransform, sourceWidth, tracks, videoDuration])

  function beginMove(id: string) {
    hostRef.current?.focus({ preventScroll: true })
    onBeginInsertGesture?.()
    dragRef.current = { mode: "move", id }
    onSelect?.({ kind: "insert", id })
  }

  function selectionBox(insert: CompositionInsert, display: CanvasDisplayMetrics) {
    return approxBox(
      layoutOverlayInsert(
        insert,
        captionStyle,
        captionPreset,
        tracks,
        project ?? {},
        videoDuration,
      ),
      display.displayScale,
      naturals.get(insert.id),
      chipBoxes.get(insert.id) ?? null,
      fontId,
      undefined,
      textLayouts.get(insert.id) ?? null,
    )
  }

  function laidOut(insert: CompositionInsert) {
    return layoutOverlayInsert(
      insert,
      captionStyle,
      captionPreset,
      tracks,
      project ?? {},
      videoDuration,
    )
  }

  function beginResize(insert: CompositionInsert, event: React.PointerEvent, _corner: ResizeCorner) {
    const host = hostRef.current
    if (!host) return
    const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
    const play = clientToPlay(event.clientX, event.clientY, display)
    const box = selectionBox(insert, display)
    if (!box) return
    const pointer = play.inside
      ? { x: play.playX, y: play.playY }
      : { x: box.cx, y: box.cy }
    const startDist = Math.hypot(pointer.x - box.cx, pointer.y - box.cy)
    onBeginInsertGesture?.()
    dragRef.current = {
      mode: "resize",
      id: insert.id,
      center: { x: box.cx, y: box.cy },
      startDist,
      base: laidOut(insert),
    }
    onSelect?.({ kind: "insert", id: insert.id })
  }

  function beginRotate(insert: CompositionInsert, event: React.PointerEvent) {
    const host = hostRef.current
    if (!host) return
    const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
    const box = selectionBox(insert, display)
    const pointer = pointerInPlay(event.clientX, event.clientY, display)
    if (!box || !pointer) return
    onBeginInsertGesture?.()
    dragRef.current = {
      mode: "rotate",
      id: insert.id,
      center: { x: box.cx, y: box.cy },
      startRotation: box.rotation ?? 0,
      startPointerDeg: angleDegFromCenter({ x: box.cx, y: box.cy }, pointer),
      base: laidOut(insert),
    }
    onSelect?.({ kind: "insert", id: insert.id })
  }

  function beginEdge(insert: CompositionInsert, edge: ResizeEdge, event: React.PointerEvent) {
    const host = hostRef.current
    if (!host) return
    const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
    const box = selectionBox(insert, display)
    const pointer = pointerInPlay(event.clientX, event.clientY, display)
    if (!box || !pointer) return
    const rotationDeg = box.rotation ?? 0
    const local = localPoint({ x: box.cx, y: box.cy }, pointer, rotationDeg)
    const startWidthPct = laidOut(insert).maxWidthPct ?? DEFAULT_MAX_WIDTH_PCT
    onBeginInsertGesture?.()
    dragRef.current = {
      mode: "ew",
      id: insert.id,
      edge,
      center: { x: box.cx, y: box.cy },
      startWidthPct,
      startLocalX: local.x,
      rotationDeg,
      base: laidOut(insert),
    }
    onSelect?.({ kind: "insert", id: insert.id })
  }

  function flushWheelGesture() {
    if (wheelCommitTimerRef.current != null) {
      window.clearTimeout(wheelCommitTimerRef.current)
      wheelCommitTimerRef.current = null
    }
    if (!wheelActiveRef.current) return
    wheelActiveRef.current = false
    framingOpsRef.current.commitLiveFraming()
    onSourceFramingActiveRef.current?.(false)
    onEndInsertGestureRef.current?.()
  }

  function beginSourcePan(
    clientX: number,
    clientY: number,
    capture?: { target: HTMLElement; pointerId: number },
  ) {
    if (!(sourceWidth > 0 && sourceHeight > 0)) return
    const host = hostRef.current
    if (!host) return
    const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
    const pointer = pointerInPlay(clientX, clientY, display)
    if (!pointer) return
    flushWheelGesture()
    host.focus({ preventScroll: true })
    if (capture) {
      try {
        capture.target.setPointerCapture(capture.pointerId)
      } catch {
        /* pointer already released */
      }
    }
    onBeginInsertGestureRef.current?.()
    onSourceFramingActiveRef.current?.(true)
    const base = sourceTransformOrDefault(sourceTransformRef.current)
    dragRef.current = {
      mode: "source-pan",
      startPlay: { x: pointer.x, y: pointer.y },
      base,
      axis: null,
      last: base,
    }
  }

  function beginSourceResize(corner: ResizeCorner, clientX: number, clientY: number) {
    if (!(sourceWidth > 0 && sourceHeight > 0)) return
    const host = hostRef.current
    if (!host) return
    const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
    const pointer = pointerInPlay(clientX, clientY, display)
    if (!pointer) return
    const base = sourceTransformOrDefault(sourceTransformRef.current)
    const rect = getVideoRect(base, sourceWidth, sourceHeight, PLAY_W, PLAY_H)
    const pivot = videoCorner(rect, OPPOSITE_CORNER[corner])
    const center = { x: PLAY_W / 2, y: PLAY_H / 2 }
    const startDist = Math.hypot(pointer.x - pivot.x, pointer.y - pivot.y)
    const centerDist = Math.hypot(pointer.x - center.x, pointer.y - center.y)
    if (startDist < 1 && centerDist < 1) return
    flushWheelGesture()
    onBeginInsertGestureRef.current?.()
    onSourceFramingActiveRef.current?.(true)
    dragRef.current = {
      mode: "source-resize",
      corner,
      pivot,
      startDist: Math.max(startDist, 1),
      centerDist: Math.max(centerDist, 1),
      base,
      last: base,
    }
  }

  function hitInsertAt(clientX: number, clientY: number, display: CanvasDisplayMetrics) {
    const play = clientToPlay(clientX, clientY, display)
    if (!play.inside) return { play, hit: null }
    const hit = hitTestOverlays(
      activeOverlays,
      play.playX,
      play.playY,
      display.displayScale,
      naturals,
      chipBoxes,
      fontId,
      textLayouts,
    )
    return { play, hit }
  }

  function onStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const host = hostRef.current
    if (!host) return
    const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
    const { play, hit } = hitInsertAt(event.clientX, event.clientY, display)
    if (!play.inside) return
    if (samplingColor && onSamplePlayColor) {
      event.preventDefault()
      const hex = onSamplePlayColor(play.playX, play.playY)
      if (hex && selectedInsert && insertKind(selectedInsert) === "text") {
        onPatchInsert?.(selectedInsert.id, {
          style: { ...selectedInsert.style, color: hex },
        })
      }
      setSamplingColor(false)
      return
    }
    hostRef.current?.focus({ preventScroll: true })
    if (!hit) {
      onEditingTextId?.(null)
      onSelect?.({ kind: "source" })
      event.preventDefault()
      const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : host
      beginSourcePan(event.clientX, event.clientY, {
        target,
        pointerId: event.pointerId,
      })
      return
    }
    event.preventDefault()
    if (editingTextId && hit.id !== editingTextId) onEditingTextId?.(null)
    beginMove(hit.id)
  }

  function onStageDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const host = hostRef.current
    if (!host) return
    const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
    const { play, hit } = hitInsertAt(event.clientX, event.clientY, display)
    if (!play.inside) return
    event.preventDefault()
    if (hit) {
      const insert = inserts.find((item) => item.id === hit.id)
      const kind = insert ? insertKind(insert) : null
      if (kind === "text" || kind === "caption") {
        onSelect?.({ kind: "insert", id: hit.id })
        onEditingTextId?.(hit.id)
      }
      return
    }
    const percent = percentsFromCenter(play.playX, play.playY)
    onCreateTextAt?.(percent.x, percent.y)
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    function onWheel(event: WheelEvent) {
      if (!(sourceWidthRef.current > 0 && sourceHeightRef.current > 0)) return
      const drag = dragRef.current
      if (drag && drag.mode !== "source-pan" && drag.mode !== "source-resize") return
      if (drag?.mode === "source-pan" || drag?.mode === "source-resize") return
      const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
      const pointer = pointerInPlay(event.clientX, event.clientY, display)
      if (!pointer) return
      const selected = selectionRef.current
      if (selected && !isSourceSelected(selected) && insertIdOf(selected)) return
      event.preventDefault()
      onSelectRef.current?.({ kind: "source" })
      const current =
        liveFramingRef.current ?? sourceTransformOrDefault(sourceTransformRef.current)
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.003 : 0.0015))
      const next = scaleSourceTransformAt(
        current,
        factor,
        pointer,
        sourceWidthRef.current,
        sourceHeightRef.current,
      )
      if (!wheelActiveRef.current) {
        wheelActiveRef.current = true
        onBeginInsertGestureRef.current?.()
        onSourceFramingActiveRef.current?.(true)
      }
      framingOpsRef.current.queueLiveFraming(next)
      if (wheelCommitTimerRef.current != null) {
        window.clearTimeout(wheelCommitTimerRef.current)
      }
      wheelCommitTimerRef.current = window.setTimeout(() => {
        wheelCommitTimerRef.current = null
        wheelActiveRef.current = false
        framingOpsRef.current.commitLiveFraming(liveFramingRef.current ?? next)
        onSourceFramingActiveRef.current?.(false)
        onEndInsertGestureRef.current?.()
      }, 140)
    }
    host.addEventListener("wheel", onWheel, { passive: false })
    return () => host.removeEventListener("wheel", onWheel)
  }, [])

  useEffect(() => {
    return () => {
      if (framingRafRef.current != null) window.cancelAnimationFrame(framingRafRef.current)
      if (wheelCommitTimerRef.current != null) window.clearTimeout(wheelCommitTimerRef.current)
    }
  }, [])

  function placeFloatingBar(bar: React.ReactNode) {
    if (!bar || !floatingBarContainer) return bar
    return createPortal(bar, floatingBarContainer)
  }

  const framingCursor = liveFraming ? "cursor-grabbing" : isSourceSelected(selection) ? "cursor-grab" : ""
  const snapX = liveFraming != null && Math.abs(liveFraming.x) < 0.6
  const snapY = liveFraming != null && Math.abs(liveFraming.y) < 0.6

  return (
    <div
      ref={hostRef}
      data-preview-stage
      tabIndex={0}
      className={`absolute inset-0 z-[12] outline-none ${framingCursor}`}
      aria-label="Pré-visualização dos inserts"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
      {snapX ? (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[13] w-px bg-sky-400/80" />
      ) : null}
      {snapY ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[13] h-px bg-sky-400/80" />
      ) : null}
      {moveGuides.x != null && metrics && hostBox ? (
        <div
          className="pointer-events-none absolute top-0 z-[14] h-full w-px bg-sky-400/90"
          style={{ left: playToClient(moveGuides.x, 0, metrics).x - hostBox.left }}
        />
      ) : null}
      {moveGuides.y != null && metrics && hostBox ? (
        <div
          className="pointer-events-none absolute left-0 z-[14] h-px w-full bg-sky-400/90"
          style={{ top: playToClient(0, moveGuides.y, metrics).y - hostBox.top }}
        />
      ) : null}
      {placeFloatingBar(selectedVisible && insertKind(selectedVisible) === "text" && !editingTextId ? (
        <TextFloatingBar
          docked={floatingBarContainer !== null}
          presetId={selectedVisible.preset}
          color={
            (selectedVisible.style as { color?: string } | undefined)?.color ??
            (isTextPresetId(selectedVisible.preset)
              ? getTextPreset(selectedVisible.preset).color
              : "#ffffff")
          }
          align={selectedVisible.textAlign ?? "center"}
          fontFamily={
            TEXT_PRESET_FONT_FILES.find((font) => font.id === selectedVisible.fontFamily)?.family ??
            selectedVisible.fontFamily ??
            "Anton"
          }
          sampling={samplingColor}
          backgroundOn={textBackgroundEnabledOf(selectedVisible)}
          shadowOn={textShadowEnabledOf(selectedVisible)}
          radius={textRadiusOf(selectedVisible)}
          radiusEnabled={textBackgroundEnabledOf(selectedVisible)}
          onPreset={(id) => onPatchInsert?.(selectedVisible.id, applyTextPreset(selectedVisible, id))}
          onColor={(hex) =>
            onPatchInsert?.(selectedVisible.id, {
              style: { ...selectedVisible.style, color: hex },
            })
          }
          onBackground={(on) =>
            onPatchInsert?.(selectedVisible.id, applyTextBackground(selectedVisible, on))
          }
          onShadow={(on) => onPatchInsert?.(selectedVisible.id, applyTextShadow(selectedVisible, on))}
          onNudgeRadius={(delta) =>
            onPatchInsert?.(selectedVisible.id, nudgeTextRadius(selectedVisible, delta))
          }
          onAlign={(align) => onPatchInsert?.(selectedVisible.id, { textAlign: align })}
          onFont={(family) =>
            onPatchInsert?.(selectedVisible.id, applyFontFamily(selectedVisible, family))
          }
          onSample={() => setSamplingColor((value) => !value)}
          onAdvanced={() => onOpenAdvanced?.(selectedVisible.id)}
        />
      ) : null)}
      {placeFloatingBar(selectedVisible && isChipInsert(selectedVisible) ? (
        <ElementFloatingBar
          docked={floatingBarContainer !== null}
          text={
            typeof selectedVisible.text === "string"
              ? selectedVisible.text
              : elementTextOf(selectedVisible)
          }
          hasText={getElementPreset(selectedVisible.type)?.hasText !== false}
          multiline={wrapsElementText(selectedVisible)}
          primary={elementColorsOf(selectedVisible).primary}
          secondary={elementColorsOf(selectedVisible).secondary}
          scale={elementScaleOf(selectedVisible)}
          maxWidthPct={wrapsElementText(selectedVisible) ? elementMaxWidthPctOf(selectedVisible) : undefined}
          onText={(value) => onPatchInsert?.(selectedVisible.id, applyElementText(selectedVisible, value))}
          onPrimary={(hex) =>
            onPatchInsert?.(selectedVisible.id, applyElementColors(selectedVisible, { primary: hex }))
          }
          onSecondary={(hex) =>
            onPatchInsert?.(selectedVisible.id, applyElementColors(selectedVisible, { secondary: hex }))
          }
          onNudgeScale={(delta) =>
            onPatchInsert?.(selectedVisible.id, nudgeElementScale(selectedVisible, delta))
          }
          onNudgeMaxWidth={
            wrapsElementText(selectedVisible)
              ? (delta) => onPatchInsert?.(selectedVisible.id, nudgeElementMaxWidth(selectedVisible, delta))
              : undefined
          }
        />
      ) : null)}
      <div
        className="absolute inset-0"
        onPointerDown={onStagePointerDown}
        onDoubleClick={onStageDoubleClick}
      >
        {editingInsert && editorView ? (
          <TextInlineEditor
            key={editingInsert.id}
            initialText={editingInsert.text ?? ""}
            css={editorView.css}
            placement={editorView.placement}
            onChange={(text) => onPatchInsert?.(editingInsert.id, { text })}
            onCommit={() => {
              restoreStageFocusAfterEditor()
              onEditingTextId?.(null)
            }}
            onCancel={() => {
              restoreStageFocusAfterEditor()
              onCancelTextEdit?.()
            }}
          />
        ) : null}
        {!editingTextId && isSourceSelected(selection) && metrics && hostBox ? (
          <SelectionOverlay
            box={{ cx: PLAY_W / 2, cy: PLAY_H / 2, w: PLAY_W, h: PLAY_H }}
            metrics={metrics}
            host={hostBox}
            showRotate={false}
            showEdgeHandles={false}
            onMovePointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              const host = hostRef.current
              if (!host) return
              const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
              const { hit } = hitInsertAt(event.clientX, event.clientY, display)
              if (hit) {
                beginMove(hit.id)
                return
              }
              beginSourcePan(event.clientX, event.clientY, {
                target: event.currentTarget instanceof HTMLElement ? event.currentTarget : host,
                pointerId: event.pointerId,
              })
            }}
            onResizePointerDown={(corner, event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              const host = hostRef.current
              if (!host) return
              const display = getCanvasDisplayMetrics(host.getBoundingClientRect())
              const { hit } = hitInsertAt(event.clientX, event.clientY, display)
              if (hit) {
                beginMove(hit.id)
                return
              }
              beginSourceResize(corner, event.clientX, event.clientY)
            }}
            onEdgePointerDown={() => {}}
            onRotatePointerDown={() => {}}
          />
        ) : !editingInsert && selectedBox && metrics && hostBox && selectedVisible ? (
          <SelectionOverlay
            box={selectedBox}
            metrics={metrics}
            host={hostBox}
            onMovePointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              beginMove(selectedVisible.id)
            }}
            onResizePointerDown={(corner, event) => {
              if (event.button !== 0) return
              event.preventDefault()
              beginResize(selectedVisible, event, corner)
            }}
            onEdgePointerDown={(edge, event) => {
              if (event.button !== 0) return
              event.preventDefault()
              beginEdge(selectedVisible, edge, event)
            }}
            onRotatePointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              beginRotate(selectedVisible, event)
            }}
            showEdgeHandles={
              insertKind(selectedVisible) === "text" || insertKind(selectedVisible) === "caption"
            }
          />
        ) : !editingInsert && selectedBox && metrics && hostBox && selectedInsert ? (
          <SelectionOverlay ghost box={selectedBox} metrics={metrics} host={hostBox} />
        ) : null}
      </div>
    </div>
  )
}
