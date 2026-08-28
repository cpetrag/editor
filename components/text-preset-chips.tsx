"use client"

import { CaptionStyleThumb } from "@/components/caption-style-thumb"
import { cn } from "@/lib/utils"
import { PLAY_W } from "@/lib/compose/layout"
import {
  TEXT_PRESET_GROUP_LABELS,
  TEXT_PRESETS,
  textPresetToInsertStyle,
  type TextPresetId,
} from "@/lib/text-presets"

export function TextPresetChips({
  selectedId,
  modified,
  onSelect,
  onReset,
}: {
  selectedId?: string
  modified?: boolean
  onSelect: (id: TextPresetId) => void
  onReset?: () => void
}) {
  const groups = ["impacto", "destaque", "apoio"] as const
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Estilo de texto</p>
        {modified ? (
          <button
            type="button"
            className="text-[0.7rem] font-medium text-brand hover:underline"
            onClick={onReset}
          >
            voltar ao preset
          </button>
        ) : null}
      </div>
      {modified ? (
        <p className="text-[0.7rem] text-muted-foreground">modificado</p>
      ) : null}
      {groups.map((group) => {
        const presets = TEXT_PRESETS.filter((preset) => preset.group === group)
        return (
          <div key={group} className="flex flex-col gap-1.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {TEXT_PRESET_GROUP_LABELS[group]}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((preset) => {
                const active = selectedId === preset.id
                const painted = textPresetToInsertStyle(preset, PLAY_W, {
                  x: 50,
                  y: 50,
                  fontSize: 72,
                })
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(preset.id as TextPresetId)}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-md border text-left transition-colors",
                      active
                        ? "border-brand ring-1 ring-brand"
                        : "border-border hover:border-brand/50",
                    )}
                  >
                    <CaptionStyleThumb painted={painted} className="h-14 w-full" />
                    <span className="px-1.5 py-1 text-[0.7rem] font-medium text-foreground">
                      {preset.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
