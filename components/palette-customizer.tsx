"use client"

import { useEffect, useState } from "react"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  COLOR_SLOTS,
  COLOR_SLOT_LABEL,
  isCustomBrandKitId,
  mergeBrandColors,
  originKitId,
  parseHexColor,
  resolveBrandKit,
  type BrandColors,
  type ColorSlot,
  type CustomBrandKit,
} from "@/lib/brand/kits"
import { slotPaths, slotsInStyle } from "@/lib/brand/slot-colors"
import { getPresetStyle } from "@/lib/style/presets"
import { cn } from "@/lib/utils"

export type PalettePhase = "gesture" | "discrete"

export type PaletteController = {
  kitId: string
  customKits: readonly CustomBrandKit[]
  projectColors: BrandColors
  onSelectKit: (id: string) => void
  onProjectColors: (colors: BrandColors, phase: PalettePhase) => void
  onInsertOverride: (ids: readonly string[], override: Partial<BrandColors> | null, phase: PalettePhase) => void
  onSlotHex: (ids: readonly string[], slot: ColorSlot, hex: string, phase: PalettePhase) => void
  onSaveKit: (name: string, colors: BrandColors) => void
  onRenameKit: (id: string, label: string) => void
  onDeleteKit: (id: string) => void
  onBegin: () => void
  onEnd: () => void
}

export function PaletteCustomizer({
  palette,
  insertIds,
  presetId,
  override,
  styleOverrides,
  scope,
  onScope,
}: {
  palette: PaletteController
  insertIds: readonly string[]
  presetId?: string
  override?: Partial<BrandColors>
  styleOverrides?: unknown
  scope: "project" | "insert"
  onScope: (scope: "project" | "insert") => void
}) {
  const [tab, setTab] = useState<"cores" | "avancado">("cores")
  const stored = resolveBrandKit(palette.kitId, palette.customKits)
  const working = scope === "insert" ? mergeBrandColors(palette.projectColors, override) : palette.projectColors
  const slots = presetId ? slotsInStyle(getPresetStyle(presetId)) : []
  const custom = isCustomBrandKitId(palette.kitId)

  function setSlot(slot: ColorSlot, hex: string, phase: PalettePhase) {
    if (scope === "project") {
      palette.onProjectColors({ ...working, [slot]: hex }, phase)
      return
    }
    palette.onInsertOverride(insertIds, { ...override, [slot]: hex }, phase)
  }

  function restore() {
    if (scope === "insert") {
      palette.onInsertOverride(insertIds, null, "discrete")
      return
    }
    const origin = resolveBrandKit(palette.kitId, palette.customKits)
    palette.onProjectColors(
      {
        primary: origin.primary,
        onPrimary: origin.onPrimary,
        accent: origin.accent,
        ink: origin.ink,
        paper: origin.paper,
      },
      "discrete",
    )
  }

  function save() {
    const name = window.prompt("Nome da paleta")
    if (!name?.trim()) return
    palette.onSaveKit(name.trim(), working)
  }

  function rename() {
    const name = window.prompt("Novo nome", stored.label)
    if (!name?.trim()) return
    palette.onRenameKit(palette.kitId, name.trim())
  }

  function remove() {
    if (!window.confirm(`Excluir a paleta “${stored.label}”? Os projetos já feitos mantêm as cores.`)) return
    palette.onDeleteKit(palette.kitId)
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[0.65rem] text-foreground hover:bg-muted"
        aria-label="Personalizar paleta"
      >
        <Pencil className="size-3" />
        Personalizar
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">Cores · {stored.label}</p>
          <span className="text-[0.65rem] text-muted-foreground">
            base {originKitId(palette.kitId, palette.customKits)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-border p-0.5" role="radiogroup" aria-label="Onde aplicar">
          {(
            [
              ["project", "Todos os inserts do projeto"],
              ["insert", "Só este insert"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={scope === id}
              className={cn(
                "rounded px-2 py-1 text-[0.65rem]",
                scope === id ? "bg-foreground text-background" : "text-muted-foreground",
              )}
              onClick={() => onScope(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            type="button"
            className={cn("rounded px-2 py-1 text-xs", tab === "cores" ? "bg-foreground text-background" : "text-muted-foreground")}
            onClick={() => setTab("cores")}
          >
            Paleta
          </button>
          <button
            type="button"
            className={cn("rounded px-2 py-1 text-xs", tab === "avancado" ? "bg-foreground text-background" : "text-muted-foreground")}
            onClick={() => setTab("avancado")}
          >
            Avançado
          </button>
        </div>
        {tab === "cores" ? (
          <div className="flex flex-col gap-2">
            {COLOR_SLOTS.map((slot) => (
              <ColorField
                key={slot}
                label={COLOR_SLOT_LABEL[slot]}
                value={working[slot]}
                onBegin={palette.onBegin}
                onEnd={palette.onEnd}
                onChange={(hex, phase) => setSlot(slot, hex, phase)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[0.65rem] text-muted-foreground">
              Troca só esse papel neste insert. A paleta do projeto fica igual.
            </p>
            {slots.length === 0 ? (
              <p className="text-xs text-muted-foreground">Este preset não usa cor da paleta.</p>
            ) : (
              slots.map((slot) => (
                <ColorField
                  key={slot}
                  label={COLOR_SLOT_LABEL[slot]}
                  value={slotHex(presetId, slot, styleOverrides) ?? working[slot]}
                  onBegin={palette.onBegin}
                  onEnd={palette.onEnd}
                  onChange={(hex, phase) => palette.onSlotHex(insertIds, slot, hex, phase)}
                />
              ))
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="xs" variant="outline" onClick={restore}>
            Restaurar original
          </Button>
          <Button type="button" size="xs" onClick={save}>
            Salvar como paleta…
          </Button>
          {custom ? (
            <>
              <Button type="button" size="xs" variant="outline" onClick={rename}>
                Renomear
              </Button>
              <Button type="button" size="xs" variant="outline" onClick={remove}>
                Excluir
              </Button>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function slotHex(presetId: string | undefined, slot: ColorSlot, overrides: unknown): string | null {
  if (!presetId) return null
  const path = slotPaths(getPresetStyle(presetId)).find((row) => row.slot === slot)?.path
  if (!path) return null
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[key]
  }, overrides)
  return parseHexColor(value)
}

function ColorField({
  label,
  value,
  onChange,
  onBegin,
  onEnd,
}: {
  label: string
  value: string
  onChange: (hex: string, phase: PalettePhase) => void
  onBegin: () => void
  onEnd: () => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const shown = parseHexColor(draft) ?? value
  return (
    <label className="flex items-center gap-2 text-[0.7rem]">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <input
        type="color"
        aria-label={label}
        className="size-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
        value={shown.toLowerCase()}
        onPointerDown={onBegin}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onChange={(event) => {
          const hex = parseHexColor(event.target.value)
          if (!hex) return
          setDraft(hex)
          onChange(hex, "gesture")
        }}
      />
      <input
        value={draft}
        spellCheck={false}
        className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-1.5 font-mono text-[0.7rem] uppercase"
        onFocus={() => {
          setDraft(value)
          onBegin()
        }}
        onBlur={() => {
          const hex = parseHexColor(draft)
          if (hex) onChange(hex, "gesture")
          else setDraft(value)
          onEnd()
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          const hex = parseHexColor(event.target.value)
          if (hex) onChange(hex, "gesture")
        }}
      />
    </label>
  )
}
