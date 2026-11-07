"use client"

import { insertLabel } from "@/lib/insert-ops"
import type { Insert } from "@/lib/inserts"

/** Barra Aplicar/Cancelar, fora do frame. O pointerdown não tira o foco do texto. */
export function TextCommitBar({
  insert,
  onApply,
  onCancel,
}: {
  insert: Insert
  onApply: () => void
  onCancel: () => void
}) {
  const label = insertLabel(insert)
  return (
    <div
      role="toolbar"
      aria-label="Edição de texto"
      data-text-commit-bar
      className="pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-xs text-card-foreground shadow-lg"
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) {
          event.preventDefault()
        }
      }}
    >
      <span className="max-w-[12rem] truncate font-medium" title={label}>
        {label}
      </span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <button
        type="button"
        className="rounded-full bg-brand px-2.5 py-1 font-medium text-brand-foreground hover:bg-brand/90"
        onClick={onApply}
      >
        Aplicar
      </button>
      <button
        type="button"
        className="rounded-full px-2.5 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onCancel}
      >
        Cancelar
      </button>
    </div>
  )
}
