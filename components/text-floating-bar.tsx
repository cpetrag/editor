"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Ellipsis,
  Minus,
  Pipette,
  Plus,
  Square,
  Sun,
  SwatchBook,
  Type,
} from "lucide-react"

import { TOGGLE_INLINE_ACCENT } from "@/components/text-inline-editor"
import { TEXT_PRESETS, type TextPresetId } from "@/lib/text-presets"
import { FONT_OPTIONS } from "@/lib/fonts"
import type { OverlayTextAlign } from "@/lib/composition"
import { cn } from "@/lib/utils"
import { visibleToolbarCount } from "@/lib/toolbar-fit"

const ALIGNMENTS: OverlayTextAlign[] = ["left", "center", "right"]
const TOOLBAR_GAP_PX = 4

function fontChoices(fontId: string) {
  if (FONT_OPTIONS.some((font) => font.id === fontId)) return FONT_OPTIONS
  return [{ id: fontId, label: fontId || "Fonte", family: fontId, vibe: "" }, ...FONT_OPTIONS]
}

function ToolbarPieces({
  pieces,
  docked,
}: {
  pieces: { key: string; node: ReactNode }[]
  docked: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(pieces.length)
  const [menuOpen, setMenuOpen] = useState(false)

  useLayoutEffect(() => {
    if (!docked) return
    const host = hostRef.current
    const measure = measureRef.current
    if (!host || !measure) return
    const apply = () => {
      const styles = getComputedStyle(host)
      const pad = (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0)
      const widths = [...measure.children].map((child) => (child as HTMLElement).offsetWidth)
      setVisibleCount(visibleToolbarCount(widths, host.clientWidth - pad, TOOLBAR_GAP_PX))
    }
    const observer = new ResizeObserver(apply)
    observer.observe(host)
    apply()
    return () => observer.disconnect()
  }, [docked, pieces.length])

  useLayoutEffect(() => {
    if (!menuOpen) return
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("pointerdown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const visible = docked ? pieces.slice(0, visibleCount) : pieces
  const overflow = docked ? pieces.slice(visibleCount) : []

  return (
    <div
      ref={hostRef}
      role="toolbar"
      aria-label="Estilo do texto"
      className={cn(
        "pointer-events-auto z-30 flex items-center gap-1 border border-white/10 bg-zinc-950/85 px-2 py-1.5 text-zinc-100 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md",
        docked
          ? "absolute left-1/2 top-0 z-30 w-max max-w-full -translate-x-1/2 flex-wrap justify-center rounded-2xl"
          : "absolute bottom-3 left-1/2 z-30 -translate-x-1/2 flex-nowrap rounded-full",
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {docked ? (
        <div ref={measureRef} className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-1" aria-hidden>
          {pieces.map((piece) => (
            <div key={piece.key} className="shrink-0">
              {piece.node}
            </div>
          ))}
        </div>
      ) : null}
      {visible.map((piece) => (
        <div key={piece.key} className="shrink-0">
          {piece.node}
        </div>
      ))}
      {overflow.length > 0 ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Mais opções de estilo"
            aria-expanded={menuOpen}
            title="Mais opções"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex size-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
          >
            <Ellipsis className="size-3.5" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-40 mt-1 flex w-max max-w-[min(22rem,calc(100vw-2rem))] flex-wrap gap-1 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-xl">
              {overflow.map((piece) => (
                <div key={piece.key} className="shrink-0">
                  {piece.node}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function TextFloatingBar({
  presetId,
  color,
  align,
  fontId,
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
  fontId: string
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
  const colorValue = color.startsWith("#") && color.length === 7 ? color : "#ffffff"
  const pieces: { key: string; node: ReactNode }[] = [
    ...TEXT_PRESETS.map((preset) => ({
      key: preset.id,
      node: (
        <button
          type="button"
          title={preset.name}
          aria-pressed={presetId === preset.id}
          onClick={() => onPreset(preset.id as TextPresetId)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-[0.7rem] font-black",
            presetId === preset.id ? "bg-sky-400 text-zinc-950" : "bg-white/5 hover:bg-white/10",
          )}
        >
          A
        </button>
      ),
    })),
    {
      key: "accent",
      node: (
        <button
          type="button"
          title="Destacar"
          aria-label="Destacar"
          onClick={() => window.dispatchEvent(new Event(TOGGLE_INLINE_ACCENT))}
          className="flex size-7 items-center justify-center rounded-full bg-white/5 text-[0.7rem] font-black text-amber-300 hover:bg-white/10"
        >
          B
        </button>
      ),
    },
    {
      key: "color",
      node: (
        <label className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white/5 hover:bg-white/10">
          <span className="size-3.5 rounded-full border border-white/30" style={{ background: color }} />
          <input
            type="color"
            value={colorValue}
            onChange={(event) => onColor(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Cor do texto"
          />
        </label>
      ),
    },
    {
      key: "sample",
      node: (
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
      ),
    },
    {
      key: "background",
      node: (
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
      ),
    },
    {
      key: "shadow",
      node: (
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
      ),
    },
    {
      key: "radius",
      node: (
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
      ),
    },
    {
      key: "align",
      node: (
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
      ),
    },
    {
      key: "font",
      node: (
        <label className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[0.65rem]">
          <Type className="size-3 shrink-0" />
          <select
            value={fontId}
            onChange={(event) => onFont(event.target.value)}
            className="max-w-[7.5rem] bg-transparent text-zinc-100 outline-none"
            aria-label="Fonte"
          >
            {fontChoices(fontId).map((font) => (
              <option key={font.id} value={font.id} className="text-zinc-950">
                {font.label}
              </option>
            ))}
          </select>
        </label>
      ),
    },
    {
      key: "advanced",
      node: (
        <button
          type="button"
          title="Avançado"
          onClick={onAdvanced}
          className="flex size-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
        >
          <SwatchBook className="size-3.5" />
        </button>
      ),
    },
  ]

  return <ToolbarPieces pieces={pieces} docked={docked} />
}
