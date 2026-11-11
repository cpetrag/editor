"use client"

import { useEffect, useRef, useState } from "react"
import { Pipette, Plus, RotateCcw } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  COLOR_SLOT_LABEL,
  COLOR_SLOTS,
  parseHexColor,
  resolveColor,
  type BrandColors,
  type ColorSlot,
} from "@/lib/brand/kits"
import { loadRecentColors, rememberColor } from "@/lib/recent-colors"
import { cn } from "@/lib/utils"

const CHECKER =
  "bg-[linear-gradient(45deg,#d4d4d4_25%,transparent_25%),linear-gradient(-45deg,#d4d4d4_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d4_75%),linear-gradient(-45deg,transparent_75%,#d4d4d4_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0px]"

export function FineColorRow({
  label,
  stored,
  fallback,
  kit,
  opacity = 100,
  onChange,
  onReset,
  onBegin,
  onEnd,
}: {
  label: string
  /** Valor gravado no insert. `null` segue o preset. `slot:*` segue a paleta. Hex é cor solta. */
  stored: string | null
  fallback: string
  kit: BrandColors
  opacity?: number
  onChange: (value: string) => void
  onReset?: () => void
  onBegin?: () => void
  onEnd?: () => void
}) {
  const current = stored ?? fallback
  const shown = resolveColor(current, kit)
  const custom = Boolean(stored && !stored.startsWith("slot:"))
  const [recent, setRecent] = useState<string[]>([])
  const [hex, setHex] = useState(shown)
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => setHex(shown), [shown])
  useEffect(() => setRecent(loadRecentColors()), [])

  function commitHex(value: string, phase: "move" | "end") {
    const next = parseHexColor(value)
    if (!next) return
    onChange(next)
    if (phase === "end") setRecent(rememberColor(next))
  }

  async function pickFromScreen() {
    const ctor = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!ctor) return
    try {
      const result = await new ctor().open()
      const next = parseHexColor(result.sRGBHex)
      if (!next) return
      onChange(next)
      setRecent(rememberColor(next))
    } catch {
      // o usuário fechou o conta-gotas
    }
  }

  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-center gap-1">
        {COLOR_SLOTS.map((slot) => {
          const value = `slot:${slot}`
          const selected = stored === value
          return (
            <button
              key={slot}
              type="button"
              title={COLOR_SLOT_LABEL[slot]}
              aria-label={COLOR_SLOT_LABEL[slot]}
              aria-pressed={selected}
              className={cn(
                "size-5 overflow-hidden rounded-full border",
                opacity < 100 && CHECKER,
                selected ? "border-blue-500 ring-2 ring-blue-500" : "border-black/20",
              )}
              style={opacity >= 100 ? { background: kit[slot as ColorSlot] } : undefined}
              onClick={() => onChange(value)}
            >
              {opacity < 100 ? (
                <span className="block size-full" style={{ background: kit[slot as ColorSlot], opacity: opacity / 100 }} />
              ) : null}
            </button>
          )
        })}
        <Popover>
          <PopoverTrigger
            type="button"
            aria-label={`Escolher ${label}`}
            aria-pressed={custom}
            title="Cor personalizada"
            className={cn(
              "relative size-5 overflow-hidden rounded-full border",
              CHECKER,
              custom ? "border-blue-500 ring-2 ring-blue-500" : "border-black/20",
            )}
          >
            <span
              className="absolute inset-0"
              style={{
                background: custom
                  ? shown
                  : "conic-gradient(#f43f5e, #f59e0b, #22c55e, #3b82f6, #a855f7, #f43f5e)",
                opacity: custom ? Math.max(0, Math.min(1, opacity / 100)) : 1,
              }}
            />
            {custom ? null : <Plus className="relative size-3 text-white mix-blend-difference" />}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 gap-2 p-3">
            <div className="flex items-center gap-2">
              <span className={cn("size-8 shrink-0 rounded border border-black/10", CHECKER)}>
                <span className="block size-full rounded" style={{ background: shown, opacity: Math.max(0, Math.min(1, opacity / 100)) }} />
              </span>
              <input
                type="color"
                aria-label={`${label} no seletor`}
                className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                value={parseHexColor(shown)?.toLowerCase() ?? "#000000"}
                onPointerDown={() => onBegin?.()}
                onPointerUp={() => {
                  const next = parseHexColor(shownRef.current)
                  if (next) setRecent(rememberColor(next))
                  onEnd?.()
                }}
                onPointerCancel={() => onEnd?.()}
                onChange={(event) => commitHex(event.target.value, "move")}
              />
              <input
                value={hex}
                spellCheck={false}
                aria-label={`${label} em hexadecimal`}
                className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 font-mono text-xs uppercase"
                onFocus={() => onBegin?.()}
                onChange={(event) => {
                  setHex(event.target.value)
                  const next = parseHexColor(event.target.value)
                  if (next) onChange(next)
                }}
                onBlur={() => {
                  const next = parseHexColor(hex)
                  if (next) commitHex(next, "end")
                  else setHex(shown)
                  onEnd?.()
                }}
              />
              {"EyeDropper" in window ? (
                <button
                  type="button"
                  aria-label="Conta-gotas"
                  className="inline-flex size-8 items-center justify-center rounded border border-border"
                  onClick={() => void pickFromScreen()}
                >
                  <Pipette className="size-3.5" />
                </button>
              ) : null}
            </div>
            {recent.length > 0 ? (
              <div className="flex flex-wrap gap-1" aria-label="Cores recentes">
                {recent.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    className="size-5 rounded-full border border-black/20"
                    style={{ background: color }}
                    onClick={() => {
                      onChange(color)
                      setRecent(rememberColor(color))
                    }}
                  />
                ))}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        {stored ? (
          <button
            type="button"
            aria-label={`Voltar ${label} ao padrão do preset`}
            title="Voltar ao padrão do preset"
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            onClick={() => onReset?.()}
          >
            <RotateCcw className="size-3" />
          </button>
        ) : null}
      </span>
    </>
  )
}
