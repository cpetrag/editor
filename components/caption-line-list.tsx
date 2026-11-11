"use client"

import { useEffect, useRef } from "react"

import { insertKind } from "@/lib/composition"
import { formatTime, type Insert } from "@/lib/inserts"
import { scrollIntoPanelViewport } from "@/lib/scroll-panel"
import { cn } from "@/lib/utils"

export function CaptionLineList({
  inserts,
  selectedId,
  onReveal,
  exceptionIds,
}: {
  inserts: Insert[]
  selectedId: string | null
  onReveal: (id: string) => void
  exceptionIds?: string[]
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lines = inserts
    .filter((insert) => insertKind(insert) === "caption")
    .slice()
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))

  useEffect(() => {
    if (!selectedId) return
    const row = rootRef.current?.querySelector(`[data-caption-id="${CSS.escape(selectedId)}"]`)
    if (row instanceof HTMLElement) scrollIntoPanelViewport(row)
  }, [selectedId])

  if (lines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma linha ainda. Gere as legendas para editar o texto e o tempo.
      </p>
    )
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-0.5" role="list" aria-label="Linhas da legenda">
      {lines.map((insert) => {
        const selected = insert.id === selectedId
        const text = insert.text?.trim() || "Legenda vazia"
        const range = `${formatTime(insert.start)}–${formatTime(insert.start + insert.duration)}`
        return (
          <button
            key={insert.id}
            type="button"
            role="listitem"
            data-caption-id={insert.id}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left",
              selected ? "bg-brand/10 text-foreground" : "hover:bg-muted",
            )}
            onClick={() => onReveal(insert.id)}
          >
            <span className="min-w-0 flex-1 truncate text-xs">{text}</span>
            {exceptionIds?.includes(insert.id) ? (
              <span className="size-1.5 shrink-0 rounded-full bg-amber-400" title="Estilo próprio" />
            ) : null}
            <span className="shrink-0 font-mono text-[0.7rem] tabular-nums text-muted-foreground">
              {range}
            </span>
          </button>
        )
      })}
    </div>
  )
}
