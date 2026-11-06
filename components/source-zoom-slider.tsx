"use client"

import { useEffect, useRef, useState } from "react"

import {
  SOURCE_ZOOM_PERCENT_MAX,
  SOURCE_ZOOM_PERCENT_MIN,
  parseZoomPercent,
  sourceZoomPercent,
  zoomSourceTransformTo,
  type SourceTransform,
} from "@/lib/source-transform"

interface SourceZoomSliderProps {
  sourceTransform?: SourceTransform
  sourceWidth: number
  sourceHeight: number
  onPatchSourceTransform: (transform: SourceTransform) => void
  onBeginGesture?: () => void
  onEndGesture?: () => void
  /** Ex.: "Trecho 2/3" quando o vídeo foi dividido. */
  segmentLabel?: string
}

export function SourceZoomSlider({
  sourceTransform,
  sourceWidth,
  sourceHeight,
  segmentLabel,
  onPatchSourceTransform,
  onBeginGesture,
  onEndGesture,
}: SourceZoomSliderProps) {
  const percent = sourceZoomPercent(sourceTransform)
  const [draft, setDraft] = useState(String(percent))
  const [editing, setEditing] = useState(false)
  const cancelDraftRef = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(String(percent))
  }, [editing, percent])

  function applyPercent(next: number) {
    onPatchSourceTransform(
      zoomSourceTransformTo(sourceTransform, next, sourceWidth, sourceHeight),
    )
  }

  function commitDraft() {
    const parsed = parseZoomPercent(draft)
    if (parsed !== null && parsed !== percent) applyPercent(parsed)
    setDraft(String(parsed ?? percent))
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 text-[0.65rem] text-muted-foreground">
      <button
        type="button"
        onClick={() => applyPercent(SOURCE_ZOOM_PERCENT_MIN)}
        disabled={percent === SOURCE_ZOOM_PERCENT_MIN}
        title="Voltar para 100%"
        className="[writing-mode:vertical-rl] rotate-180 tracking-wide transition-colors hover:text-foreground disabled:hover:text-muted-foreground"
      >
        Zoom
      </button>
      <input
        type="range"
        min={SOURCE_ZOOM_PERCENT_MIN}
        max={SOURCE_ZOOM_PERCENT_MAX}
        step={1}
        value={percent}
        aria-label="Zoom do vídeo"
        aria-valuetext={`${percent}%`}
        className="h-40 w-6 cursor-pointer accent-brand"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
        onPointerDown={() => onBeginGesture?.()}
        onPointerUp={() => onEndGesture?.()}
        onChange={(event) => applyPercent(Number(event.target.value))}
      />
      <label className="flex items-center font-mono tabular-nums text-zinc-300">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          aria-label="Zoom do vídeo em porcentagem"
          className="w-8 bg-transparent text-right outline-none focus:text-foreground focus:underline"
          onFocus={(event) => {
            setEditing(true)
            event.currentTarget.select()
          }}
          onBlur={() => {
            setEditing(false)
            if (cancelDraftRef.current) {
              cancelDraftRef.current = false
              setDraft(String(percent))
              return
            }
            commitDraft()
          }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
            if (event.key === "Escape") {
              cancelDraftRef.current = true
              event.currentTarget.blur()
            }
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              const step = (event.shiftKey ? 10 : 1) * (event.key === "ArrowUp" ? 1 : -1)
              const next = parseZoomPercent(String((parseZoomPercent(draft) ?? percent) + step))
              if (next === null) return
              setDraft(String(next))
              applyPercent(next)
            }
          }}
        />
        %
      </label>
      {segmentLabel ? (
        <span className="max-w-12 text-center text-[0.6rem] leading-tight text-sky-300">
          {segmentLabel}
        </span>
      ) : null}
    </div>
  )
}
