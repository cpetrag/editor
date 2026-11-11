"use client"

import { Fragment, useMemo, useState, type ReactNode } from "react"

import { CaptionStyleThumb } from "@/components/caption-style-thumb"
import { PresetPickerRow } from "@/components/preset-picker-row"
import { cn } from "@/lib/utils"
import {
  DEFAULT_CAPTION_STYLE,
  insertKind,
  type CaptionPreset,
  type CaptionStyle,
  type CompositionInsert,
} from "@/lib/composition"
import { captionStyleToInsertStyle } from "@/lib/style/caption-map"
import { getPresetStyle } from "@/lib/style/presets"
import {
  activeCaptionLookId,
  captionStyleChips,
  isNativeCaptionLook,
} from "@/lib/style-preset"
import type { InsertStyle, UserPreset } from "@/lib/style/types"

function paintedForLook(
  lookId: string,
  captionStyle: CaptionStyle,
  userPresets: UserPreset[],
): InsertStyle {
  if (isNativeCaptionLook(lookId)) {
    return captionStyleToInsertStyle(captionStyle, lookId)
  }
  const mine = userPresets.find((preset) => preset.id === lookId)
  if (mine) return mine.style
  return getPresetStyle(lookId)
}

export function CaptionStyleCard({
  inserts,
  captionStyle = DEFAULT_CAPTION_STYLE,
  captionPreset = "viral",
  userPresets = [],
  disabled = false,
  onSelectLook,
}: {
  inserts: CompositionInsert[]
  captionStyle?: CaptionStyle
  captionPreset?: CaptionPreset
  userPresets?: UserPreset[]
  disabled?: boolean
  onSelectLook: (lookId: string) => void
}) {
  const chips = useMemo(() => captionStyleChips(userPresets), [userPresets])
  const hasCaptions = inserts.some((insert) => insertKind(insert) === "caption")
  const activeId = activeCaptionLookId(inserts, captionPreset)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">Estilo das legendas</h3>
        <p className="text-[0.7rem] text-muted-foreground">
          O preview usa o mesmo render das legendas, com a palavra EXEMPLO.
        </p>
      </div>

      {!hasCaptions ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Gere legendas para aplicar o estilo. Sem cards de legenda, o clique não altera o vídeo.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Estilo das legendas">
        {chips.map((chip) => {
          const pressed = activeId === chip.id
          const lookDisabled = disabled || !hasCaptions
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={pressed}
              disabled={lookDisabled}
              onClick={() => onSelectLook(chip.id)}
              className={cn(
                "overflow-hidden rounded-md border text-left transition-colors",
                pressed
                  ? "border-brand ring-2 ring-brand/40"
                  : "border-border hover:border-brand/50",
                lookDisabled ? "cursor-not-allowed opacity-50" : "bg-background",
              )}
            >
              <CaptionStyleThumb
                painted={paintedForLook(chip.id, captionStyle, userPresets)}
                className="block h-16 w-full"
              />
              <span className="flex items-center justify-between gap-1 px-2 py-1">
                <span className="truncate text-[0.7rem] font-medium text-foreground">
                  {chip.label}
                </span>
                {chip.mine ? (
                  <span className="rounded bg-brand/15 px-1 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
                    meu
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CaptionPresetRow({
  inserts,
  captionStyle = DEFAULT_CAPTION_STYLE,
  captionPreset = "viral",
  userPresets = [],
  disabled = false,
  onSelectLook,
  menu,
}: {
  inserts: CompositionInsert[]
  captionStyle?: CaptionStyle
  captionPreset?: CaptionPreset
  userPresets?: UserPreset[]
  disabled?: boolean
  onSelectLook: (lookId: string) => void
  menu?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const chips = useMemo(() => captionStyleChips(userPresets), [userPresets])
  const hasCaptions = inserts.some((insert) => insertKind(insert) === "caption")
  const activeId = activeCaptionLookId(inserts, captionPreset) ?? captionPreset
  const active = chips.find((chip) => chip.id === activeId)
  const lookDisabled = disabled || !hasCaptions

  return (
    <PresetPickerRow
      label={`${active?.label ?? "Estilo"}${active?.mine ? " · meu" : ""}`}
      thumb={
        <CaptionStyleThumb
          painted={paintedForLook(activeId, captionStyle, userPresets)}
          className="h-10 w-16 shrink-0 rounded-md border border-border"
        />
      }
      open={open}
      onToggle={() => setOpen((current) => !current)}
      disabled={lookDisabled}
      menu={menu}
      gridLabel="Estilo das legendas"
    >
      {chips.map((chip, index) => {
        const pressed = activeId === chip.id
        const mineHeading = chip.mine && !chips[index - 1]?.mine
        return (
          <Fragment key={chip.id}>
            {mineHeading ? (
              <p className="col-span-2 pt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Meus estilos
              </p>
            ) : null}
            <button
            key={chip.id}
            type="button"
            aria-pressed={pressed}
            disabled={lookDisabled}
            onClick={() => onSelectLook(chip.id)}
            className={cn(
              "overflow-hidden rounded-md border text-left transition-colors",
              pressed
                ? "border-brand ring-2 ring-brand/40"
                : "border-border hover:border-brand/50",
              lookDisabled ? "cursor-not-allowed opacity-50" : "bg-background",
            )}
          >
            <CaptionStyleThumb
              painted={paintedForLook(chip.id, captionStyle, userPresets)}
              className="block h-14 w-full"
            />
            <span className="flex items-center justify-between gap-1 px-2 py-1">
              <span className="truncate text-[0.7rem] font-medium text-foreground">
                {chip.label}
              </span>
              {chip.mine ? (
                <span className="rounded bg-brand/15 px-1 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">
                  meu
                </span>
              ) : null}
            </span>
          </button>
          </Fragment>
        )
      })}
    </PresetPickerRow>
  )
}
