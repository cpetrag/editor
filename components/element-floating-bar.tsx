"use client"

import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

export function ElementFloatingBar({
  text,
  hasText,
  multiline,
  primary,
  secondary,
  scale,
  maxWidthPct,
  onText,
  onPrimary,
  onSecondary,
  onNudgeScale,
  onNudgeMaxWidth,
  docked = false,
}: {
  /** Na faixa acima do palco, em vez de por cima do vídeo. */
  docked?: boolean
  text: string
  hasText: boolean
  multiline?: boolean
  primary: string
  secondary: string
  scale: number
  maxWidthPct?: number
  onText: (value: string) => void
  onPrimary: (hex: string) => void
  onSecondary: (hex: string) => void
  onNudgeScale: (delta: number) => void
  onNudgeMaxWidth?: (delta: number) => void
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto z-30 flex items-center gap-1 border border-white/10 bg-zinc-950/85 px-2 py-1.5 text-zinc-100 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md",
        docked ? "relative max-w-full" : "absolute bottom-3 left-1/2 -translate-x-1/2",
        multiline ? "max-w-[min(92%,22rem)] flex-col items-stretch rounded-2xl" : "rounded-full",
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {hasText && multiline ? (
        <textarea
          value={text}
          onChange={(event) => onText(event.target.value)}
          aria-label="Texto do elemento"
          rows={3}
          className="min-h-[3.6rem] w-full resize-none rounded-xl bg-white/5 px-3 py-1.5 text-[0.7rem] leading-snug text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-sky-400"
          placeholder={"@conta\nTexto em várias linhas"}
        />
      ) : null}
      <div className="flex items-center justify-center gap-1">
        {hasText && !multiline ? (
          <input
            value={text}
            onChange={(event) => onText(event.target.value)}
            aria-label="Texto do elemento"
            className="h-7 w-[9.5rem] rounded-full bg-white/5 px-3 text-[0.7rem] text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-sky-400"
            placeholder="Texto"
          />
        ) : null}
        <label className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white/5 hover:bg-white/10">
          <span className="size-3.5 rounded-full border border-white/30" style={{ background: primary }} />
          <input
            type="color"
            value={primary.startsWith("#") && primary.length === 7 ? primary : "#111111"}
            onChange={(event) => onPrimary(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Cor primária"
          />
        </label>
        <label className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-white/5 hover:bg-white/10">
          <span className="size-3.5 rounded-full border border-white/30" style={{ background: secondary }} />
          <input
            type="color"
            value={secondary.startsWith("#") && secondary.length === 7 ? secondary : "#ffffff"}
            onChange={(event) => onSecondary(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Cor secundária"
          />
        </label>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button
          type="button"
          title="Diminuir"
          onClick={() => onNudgeScale(-0.1)}
          className="flex size-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="min-w-[2.2rem] text-center font-mono text-[0.65rem] tabular-nums text-zinc-300">
          {scale.toFixed(1)}×
        </span>
        <button
          type="button"
          title="Aumentar"
          onClick={() => onNudgeScale(0.1)}
          className={cn("flex size-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10")}
        >
          <Plus className="size-3.5" />
        </button>
        {onNudgeMaxWidth && typeof maxWidthPct === "number" ? (
          <>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <button
              type="button"
              title="Diminuir largura máxima"
              onClick={() => onNudgeMaxWidth(-4)}
              className="flex size-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-[2.4rem] text-center font-mono text-[0.65rem] tabular-nums text-zinc-300">
              {Math.round(maxWidthPct)}%
            </span>
            <button
              type="button"
              title="Aumentar largura máxima"
              onClick={() => onNudgeMaxWidth(4)}
              className="flex size-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
            >
              <Plus className="size-3.5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
