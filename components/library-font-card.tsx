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
  onUseOnText,
  canUseOnText = false,
  used = false,
  ariaLabel,
  loaded,
}: {
  font: FontOption
  sample: string
  selected: boolean
  onSelect: () => void
  onUseOnText?: () => void
  canUseOnText?: boolean
  used?: boolean
  ariaLabel: string
  loaded?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 text-left",
        selected ? "border-brand bg-brand/10" : "border-border bg-card",
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
          {used ? (
            <span className="rounded bg-brand/15 px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
              Usada no projeto
            </span>
          ) : null}
          {loaded ? (
            <span className="rounded bg-muted px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">
              carregada
            </span>
          ) : null}
          {selected ? <Check className="size-3.5 shrink-0 text-brand" /> : null}
        </span>
      </span>
      <span className="truncate text-[0.7rem] text-muted-foreground">{font.vibe}</span>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={!canUseOnText}
          onClick={onUseOnText}
          className="rounded-md border border-border px-2 py-1 text-left text-[0.65rem] disabled:opacity-40"
        >
          Usar no texto selecionado
        </button>
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onSelect}
          className="rounded-md bg-muted px-2 py-1 text-left text-[0.65rem]"
        >
          Definir como padrão
        </button>
      </div>
    </div>
  )
}
