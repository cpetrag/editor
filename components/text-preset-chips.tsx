"use client"

import { useState, type ReactNode } from "react"

import { CaptionStyleThumb } from "@/components/caption-style-thumb"
import { PresetPickerRow } from "@/components/preset-picker-row"
import { cn } from "@/lib/utils"
import { PLAY_W } from "@/lib/compose/layout"
import {
  TEXT_PRESET_GROUP_LABELS,
  TEXT_PRESETS,
  getTextPreset,
  isTextPresetId,
  textPresetToInsertStyle,
  type TextPresetId,
} from "@/lib/text-presets"
import { getPresetStyle } from "@/lib/style/presets"
import type { InsertStyle, UserPreset } from "@/lib/style/types"

export type StylePresetChoice = {
  id: string
  label: string
  mine?: boolean
}

function textThumb(presetId: string) {
  const preset = getTextPreset(presetId as TextPresetId)
  return textPresetToInsertStyle(preset, PLAY_W, { x: 50, y: 50, fontSize: 72 })
}

function styleThumb(id: string, userPresets: UserPreset[], fallback: InsertStyle): InsertStyle {
  const mine = userPresets.find((preset) => preset.id === id)
  if (mine) return mine.style
  try {
    return getPresetStyle(id)
  } catch {
    return fallback
  }
}

export function TextPresetChips({
  selectedId,
  modified,
  onSelect,
  onReset,
  menu,
  showTextPresets = true,
  stylePresets = [],
  activeStyleId,
  userPresets = [],
  resolvedStyle,
  onSelectStyle,
}: {
  selectedId?: string
  modified?: boolean
  onSelect: (id: TextPresetId) => void
  onReset?: () => void
  menu?: ReactNode
  showTextPresets?: boolean
  stylePresets?: StylePresetChoice[]
  activeStyleId?: string
  userPresets?: UserPreset[]
  resolvedStyle?: InsertStyle
  onSelectStyle?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const groups = ["impacto", "destaque", "apoio"] as const
  const textPreset = isTextPresetId(selectedId) ? getTextPreset(selectedId) : null
  const styleChoice = stylePresets.find((preset) => preset.id === activeStyleId)
  const label = textPreset
    ? `${textPreset.name}${modified ? " · modificado" : ""}`
    : `${styleChoice?.label ?? "Estilo"}${modified ? " · modificado" : ""}`
  const thumbPainted = textPreset
    ? textThumb(textPreset.id)
    : activeStyleId
      ? styleThumb(activeStyleId, userPresets, resolvedStyle ?? getPresetStyle(activeStyleId))
      : resolvedStyle

  return (
    <PresetPickerRow
      label={label}
      thumb={
        thumbPainted ? (
          <CaptionStyleThumb
            painted={thumbPainted}
            className="h-10 w-16 shrink-0 rounded-md border border-border"
          />
        ) : (
          <span className="h-10 w-16 shrink-0 rounded-md border border-border bg-muted" />
        )
      }
      open={open}
      onToggle={() => setOpen((current) => !current)}
      menu={menu}
      gridLabel="Presets do texto"
    >
      {showTextPresets
        ? groups.flatMap((group) => {
        const presets = TEXT_PRESETS.filter((preset) => preset.group === group)
        return presets.map((preset) => {
          const active = selectedId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              title={TEXT_PRESET_GROUP_LABELS[group]}
              onClick={() => onSelect(preset.id as TextPresetId)}
              className={cn(
                "flex flex-col overflow-hidden rounded-md border text-left transition-colors",
                active ? "border-brand ring-1 ring-brand" : "border-border hover:border-brand/50",
              )}
            >
              <CaptionStyleThumb painted={textThumb(preset.id)} className="h-14 w-full" />
              <span className="px-1.5 py-1 text-[0.7rem] font-medium text-foreground">{preset.name}</span>
            </button>
          )
        })
      })
        : null}
      {onReset && modified ? (
        <button
          type="button"
          className="col-span-2 text-left text-[0.7rem] font-medium text-brand hover:underline"
          onClick={onReset}
        >
          Voltar ao preset
        </button>
      ) : null}
      {onSelectStyle && stylePresets.length > 0 ? (
        <p className="col-span-2 pt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Preset de estilo
        </p>
      ) : null}
      {onSelectStyle
        ? stylePresets.map((preset) => {
            const pressed = preset.id === activeStyleId
            const painted = styleThumb(
              preset.id,
              userPresets,
              resolvedStyle ?? ({} as InsertStyle),
            )
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onSelectStyle(preset.id)}
                className={cn(
                  "overflow-hidden rounded-md border text-left transition-colors",
                  pressed ? "border-brand ring-2 ring-brand/40" : "border-border hover:border-brand/50",
                )}
              >
                <CaptionStyleThumb painted={painted} className="block h-14 w-full" />
                <span className="flex items-center justify-between gap-1 px-2 py-1">
                  <span className="truncate text-[0.7rem] font-medium text-foreground">{preset.label}</span>
                  {preset.mine ? (
                    <span className="rounded bg-brand/15 px-1 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
                      meu
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })
        : null}
    </PresetPickerRow>
  )
}
