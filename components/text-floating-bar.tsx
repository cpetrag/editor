"use client"

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Minus,
  Pipette,
  Plus,
  Square,
  Sun,
  SwatchBook,
  Type,
} from "lucide-react"

import { TEXT_PRESET_FONT_FILES } from "@/lib/text-presets"
import { TEXT_PRESETS, type TextPresetId } from "@/lib/text-presets"
import type { OverlayTextAlign } from "@/lib/composition"
import { cn } from "@/lib/utils"

const ALIGNMENTS: OverlayTextAlign[] = ["left", "center", "right"]

export function TextFloatingBar({
  presetId,
  color,
  align,
  fontFamily,
  sampling,
  backgroundOn,
  shadowOn,
  radius,
  radiusEnabled,
  onPreset,
  onColor,
  onBackground,
  onShadow,
  onNudgeRadius,
  onAlign,
  onFont,
  onSample,
  onAdvanced,
  docked = false,
}: {
  /** Na faixa acima do palco, em vez de por cima do vídeo. */
  docked?: boolean
  presetId?: string
  color: string
  align: OverlayTextAlign
  fontFamily: string
  sampling: boolean
  backgroundOn: boolean
  shadowOn: boolean
  radius: number
  radiusEnabled: boolean
  onPreset: (id: TextPresetId) => void
  onColor: (hex: string) => void
  onBackground: (on: boolean) => void
  onShadow: (on: boolean) => void
  onNudgeRadius: (delta: number) => void
  onAlign: (align: OverlayTextAlign) => void
  onFont: (family: string) => void
  onSample: () => void
  onAdvanced: () => void
}) {
  return (
    <div
      role="toolbar"
      aria-label="Estilo do texto"
      className={cn(
        "pointer-events-auto absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-zinc-950/85 px-2 py-1.5 text-zinc-100 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md",
        docked ? "top-1/2 max-w-full -translate-y-1/2" : "bottom-3",
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex max-w-[9.5rem] gap-0.5 overflow-x-auto">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.name}
            aria-pressed={presetId === preset.id}
            onClick={() => onPreset(preset.id as TextPresetId)}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-black",
              presetId === preset.id ? "bg-sky-400 text-zinc-950" : "bg-white/5 hover:bg-white/10",
            )}
          >
            A
          </button>
        ))}
      </div>
      <span className="mx-1 h-4 w-px bg-white/10" />
      <label className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white/5 hover:bg-white/10">
        <span className="size-3.5 rounded-full border border-white/30" style={{ background: color }} />
        <input
          type="color"
          value={color.startsWith("#") && color.length === 7 ? color : "#ffffff"}
          onChange={(event) => onColor(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Cor do texto"
        />
      </label>
      <button
        type="button"
        title="Conta-gotas"
        aria-pressed={sampling}
        onClick={onSample}
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          sampling ? "bg-sky-400 text-zinc-950" : "bg-white/5 hover:bg-white/10",
        )}
      >
        <Pipette className="size-3.5" />
      </button>
      <button
        type="button"
        title="Fundo do texto"
        aria-label="Fundo do texto"
        aria-pressed={backgroundOn}
        onClick={() => onBackground(!backgroundOn)}
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          backgroundOn ? "bg-sky-400 text-zinc-950" : "bg-white/5 hover:bg-white/10",
        )}
      >
        <Square className="size-3.5" />
      </button>
      <button
        type="button"
        title="Sombra do texto"
        aria-label="Sombra do texto"
        aria-pressed={shadowOn}
        onClick={() => onShadow(!shadowOn)}
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          shadowOn ? "bg-sky-400 text-zinc-950" : "bg-white/5 hover:bg-white/10",
        )}
      >
        <Sun className="size-3.5" />
      </button>
      <div className="flex items-center rounded-full bg-white/5 p-0.5">
        <button
          type="button"
          title="Diminuir arredondamento"
          aria-label="Diminuir arredondamento"
          disabled={!radiusEnabled}
          onClick={() => onNudgeRadius(-4)}
          className="flex size-6 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="min-w-[1.6rem] text-center font-mono text-[0.6rem] tabular-nums text-zinc-300">
          {Math.round(radius)}
        </span>
        <button
          type="button"
          title="Aumentar arredondamento"
          aria-label="Aumentar arredondamento"
          disabled={!radiusEnabled}
          onClick={() => onNudgeRadius(4)}
          className="flex size-6 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex rounded-full bg-white/5 p-0.5">
        {ALIGNMENTS.map((value) => {
          const Icon = value === "left" ? AlignLeft : value === "right" ? AlignRight : AlignCenter
          return (
            <button
              key={value}
              type="button"
              title={value}
              aria-pressed={align === value}
              onClick={() => onAlign(value)}
              className={cn(
                "flex size-6 items-center justify-center rounded-full",
                align === value ? "bg-sky-400 text-zinc-950" : "hover:bg-white/10",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          )
        })}
      </div>
      <label className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[0.65rem]">
        <Type className="size-3" />
        <select
          value={fontFamily}
          onChange={(event) => onFont(event.target.value)}
          className="max-w-[5.5rem] bg-transparent text-zinc-100 outline-none"
          aria-label="Fonte"
        >
          {TEXT_PRESET_FONT_FILES.map((font) => (
            <option key={font.id} value={font.family} className="text-zinc-950">
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        title="Avançado"
        onClick={onAdvanced}
        className="flex size-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
      >
        <SwatchBook className="size-3.5" />
      </button>
    </div>
  )
}
