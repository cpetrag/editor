"use client"

import { useEffect, useRef } from "react"

import {
  PLAY_W,
  playBoxToCss,
  type CanvasDisplayMetrics,
  type RectLike,
} from "@/lib/compose/layout"
import { getTextPreset, isTextPresetId, renderTextPreset } from "@/lib/text-presets"
import { DEFAULT_TEXT_PRESET_ID } from "@/lib/text-presets"
import type { CompositionInsert } from "@/lib/composition"

export function TextInlineEditor({
  insert,
  box,
  metrics,
  host,
  onChange,
  onCommit,
  onCancel,
}: {
  insert: CompositionInsert
  box: { cx: number; cy: number; w: number; h: number }
  metrics: CanvasDisplayMetrics
  host: RectLike
  onChange: (text: string) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const presetId = isTextPresetId(insert.preset) ? insert.preset : DEFAULT_TEXT_PRESET_ID
  const painted = renderTextPreset(getTextPreset(presetId), insert.text ?? "", PLAY_W)
  const css = playBoxToCss(box, metrics, host)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [])

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label="Editar texto"
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      data-text-inline-editor
      className="absolute z-30 outline-none"
      style={{
        left: css.left,
        top: css.top,
        minWidth: css.width,
        minHeight: css.height,
        fontFamily: painted.style.fontFamily,
        fontWeight: painted.style.fontWeight,
        fontSize: insert.fontSize ?? painted.style.fontSize,
        color: painted.style.color,
        letterSpacing: painted.style.letterSpacing,
        lineHeight: painted.style.lineHeight,
        textTransform: painted.style.textTransform,
        textAlign: insert.textAlign ?? painted.style.textAlign,
        whiteSpace: "pre-wrap",
        caretColor: "#38bdf8",
      }}
      onInput={(event) => onChange(event.currentTarget.innerText)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === "Escape") {
          event.preventDefault()
          onCancel()
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault()
          onCommit()
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {insert.text}
    </div>
  )
}
