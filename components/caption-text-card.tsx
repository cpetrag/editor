"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  CAPTION_TEXT_PLACEHOLDER,
  captionTextEditorState,
} from "@/lib/caption-panel"
import type { Insert } from "@/lib/inserts"
import { cn } from "@/lib/utils"

export function CaptionTextCard({
  inserts,
  selectedId,
  onChange,
  onBeginInsertGesture,
  onEndInsertGesture,
}: {
  inserts: Insert[]
  selectedId: string | null
  onChange: (id: string, patch: Partial<Insert>) => void
  onBeginInsertGesture?: () => void
  onEndInsertGesture?: () => void
}) {
  const state = captionTextEditorState(inserts, selectedId)
  const editingId = state.mode === "editing" ? state.insert.id : null
  const [expanded, setExpanded] = useState(Boolean(editingId))

  useEffect(() => {
    setExpanded(Boolean(editingId))
  }, [editingId])

  if (state.mode === "placeholder") {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">{CAPTION_TEXT_PLACEHOLDER}</p>
      </div>
    )
  }

  const insert = state.insert
  const preview = insert.text?.trim() || "Legenda"

  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        expanded ? "border-brand ring-1 ring-brand/40" : "border-border",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/60"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Recolher" : "Expandir"} texto da legenda`}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {preview}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <Field>
            <FieldLabel htmlFor={`caption-text-${insert.id}`}>Texto desta linha</FieldLabel>
            <Textarea
              id={`caption-text-${insert.id}`}
              value={insert.text ?? ""}
              placeholder="Texto da linha"
              rows={3}
              onChange={(event) => onChange(insert.id, { text: event.target.value })}
              onFocus={() => onBeginInsertGesture?.()}
              onBlur={() => onEndInsertGesture?.()}
            />
          </Field>
          <p className="text-[0.7rem] text-muted-foreground">
            Tempo: arraste o clipe na timeline
          </p>
        </div>
      ) : null}
    </div>
  )
}
