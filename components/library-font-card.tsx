"use client"

import { Check } from "lucide-react"

import { FONT_PREVIEW_SAMPLE, type FontOption } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export function fontPreviewText(sample: string): string {
  return (sample.trim() || FONT_PREVIEW_SAMPLE).toLocaleUpperCase("pt-BR")
}

export function FontPreviewCard({
  font,
  sample,
  selected,
  onSelect,
  ariaLabel,
  loaded,
}: {
  font: FontOption
  sample: string
  selected: boolean
  onSelect: () => void
  ariaLabel: string
  loaded?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-brand bg-brand/10"
          : "border-border bg-card hover:border-brand/50 hover:bg-accent",
      )}
    >
      <span
        className="line-clamp-2 text-lg leading-tight text-foreground"
        style={{ fontFamily: font.family }}
      >
        {fontPreviewText(sample)}
      </span>
      <span className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-foreground">{font.label}</span>
        <span className="flex items-center gap-1">
          {loaded ? (
            <span className="rounded bg-brand/15 px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
              carregada
            </span>
          ) : null}
          {selected ? <Check className="size-3.5 shrink-0 text-brand" /> : null}
        </span>
      </span>
      <span className="truncate text-[0.7rem] text-muted-foreground">{font.vibe}</span>
    </button>
  )
}
