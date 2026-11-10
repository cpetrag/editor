"use client"

import { useRef } from "react"
import { ArrowLeftRight, Pause, Repeat, Minus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { CompositionAudio } from "@/lib/audio/types"
import type { CompositionSource } from "@/lib/composition"
import { cn } from "@/lib/utils"
import {
  activeVoiceEnd,
  editorDuration,
  fitSuggestionFor,
  formatSecondsPt,
  naturalVideoSeconds,
  voiceOverrun,
  voiceOverrunMessage,
} from "@/lib/video/duration"
import {
  DEFAULT_PLAYBACK,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  clampPlaybackSpeed,
  formatPlaybackSummary,
  isIdentityPlayback,
  type FillMode,
  type SourcePlayback,
} from "@/lib/video/playback"

const FILLS: { id: FillMode; label: string; hint: string; icon: typeof Repeat }[] = [
  { id: "none", label: "Nada", hint: "O vídeo dura o que durar", icon: Minus },
  { id: "pingpong", label: "Ping-pong", hint: "Ótimo para produto parado; evite com pessoa andando ou falando", icon: ArrowLeftRight },
  { id: "loop", label: "Loop", hint: "Repete do início", icon: Repeat },
  { id: "freeze", label: "Congelar", hint: "Segura o último quadro", icon: Pause },
]

export function playbackHeaderSummary(source: CompositionSource, audio: CompositionAudio | undefined): string | null {
  if (!source.playback || isIdentityPlayback(source.playback) || !(source.duration > 0)) return null
  const useful = naturalVideoSeconds(source, { ...DEFAULT_PLAYBACK })
  return formatPlaybackSummary({
    playback: source.playback,
    outputSeconds: editorDuration(source, audio),
    videoSeconds: useful > 0 ? useful : source.duration,
  })
}

export function VideoDurationSection({
  source,
  audio,
  onChange,
  onApplyFit,
  onBegin,
  onEnd,
  reverseStatus = "idle",
}: {
  source: CompositionSource
  audio: CompositionAudio | undefined
  onChange: (playback: SourcePlayback, mode: "discrete" | "gesture") => void
  onApplyFit: () => void
  onBegin?: () => void
  onEnd?: () => void
  reverseStatus?: "idle" | "preparing" | "ready" | "error"
}) {
  const playback = source.playback ?? DEFAULT_PLAYBACK
  const useful = naturalVideoSeconds(source, { ...DEFAULT_PLAYBACK })
  const videoSeconds = useful > 0 ? useful : source.duration
  const output = editorDuration(source, audio)
  const overrun = voiceOverrun(source, audio)
  const suggestion = fitSuggestionFor(source, audio)
  const hasVoice = activeVoiceEnd(audio) > 0
  const dragging = useRef(false)

  function commit(next: SourcePlayback, mode: "discrete" | "gesture") {
    onChange(next, mode)
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Duração do vídeo</p>
        <p className="text-right font-mono text-[0.65rem] text-muted-foreground">
          {formatPlaybackSummary({
            playback,
            outputSeconds: output > 0 ? output : videoSeconds,
            videoSeconds,
          })}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-[0.7rem] text-muted-foreground">
          Velocidade
          <input
            aria-label="Velocidade numérica"
            className="w-16 rounded border border-border bg-background px-1 py-0.5 text-right font-mono text-xs text-foreground"
            inputMode="decimal"
            value={playback.speed.toFixed(2).replace(".", ",")}
            onFocus={() => onBegin?.()}
            onBlur={(event) => {
              const parsed = Number(event.target.value.replace(",", "."))
              commit({ ...playback, speed: clampPlaybackSpeed(parsed) }, "discrete")
              onEnd?.()
            }}
            onChange={(event) => {
              const parsed = Number(event.target.value.replace(",", "."))
              if (!Number.isFinite(parsed)) return
              commit({ ...playback, speed: clampPlaybackSpeed(parsed) }, dragging.current ? "gesture" : "discrete")
            }}
          />
        </span>
        <input
          type="range"
          min={PLAYBACK_SPEED_MIN}
          max={PLAYBACK_SPEED_MAX}
          step={0.01}
          aria-label="Velocidade do vídeo"
          value={playback.speed}
          className="h-5 w-full accent-brand"
          onPointerDown={() => {
            dragging.current = true
            onBegin?.()
          }}
          onPointerUp={() => {
            dragging.current = false
            onEnd?.()
          }}
          onChange={(event) => {
            commit({ ...playback, speed: clampPlaybackSpeed(Number(event.target.value)) }, "gesture")
          }}
        />
        <span className="flex justify-between font-mono text-[0.6rem] text-muted-foreground">
          <span>0,50×</span>
          <span>0,75</span>
          <span>1</span>
          <span>1,25</span>
          <span>1,50</span>
          <span>2×</span>
        </span>
        {playback.speed < 0.8 ? (
          <span className="text-[0.7rem] text-amber-700 dark:text-amber-300">Pode parecer câmera lenta.</span>
        ) : null}
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[0.7rem] text-muted-foreground">Completar com</span>
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Completar com">
          {FILLS.map((item) => {
            const Icon = item.icon
            const selected = playback.fill === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                title={item.hint}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-[0.65rem]",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-foreground hover:bg-muted",
                )}
                onClick={() => commit({ ...playback, fill: item.id }, "discrete")}
              >
                <Icon className="size-3.5" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </div>
        {playback.fill === "pingpong" ? (
          <span className="text-[0.7rem] text-muted-foreground">
            Ótimo para produto parado; evite com pessoa andando ou falando.
            {reverseStatus === "preparing" ? " Preparando volta…" : null}
            {reverseStatus === "error" ? " Não foi possível gerar a volta." : null}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[0.7rem] text-muted-foreground">Duração</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Duração">
          <FitButton
            selected={playback.fit === "video"}
            label={`Do vídeo (${formatSecondsPt(videoSeconds)} s)`}
            onClick={() => commit({ ...playback, fit: "video" }, "discrete")}
          />
          {hasVoice ? (
            <FitButton
              selected={playback.fit === "audio"}
              label={`Da locução (${formatSecondsPt(activeVoiceEnd(audio))} s)`}
              onClick={() => commit({ ...playback, fit: "audio" }, "discrete")}
            />
          ) : null}
          <FitButton
            selected={playback.fit === "manual"}
            label="Manual"
            onClick={() =>
              commit(
                {
                  ...playback,
                  fit: "manual",
                  targetDuration: playback.targetDuration ?? Math.max(output, videoSeconds),
                },
                "discrete",
              )
            }
          />
          {playback.fit === "manual" ? (
            <input
              aria-label="Duração manual em segundos"
              className="w-16 rounded border border-border bg-background px-1 py-0.5 text-right font-mono text-xs"
              inputMode="decimal"
              defaultValue={(playback.targetDuration ?? output).toFixed(2).replace(".", ",")}
              key={playback.targetDuration ?? output}
              onBlur={(event) => {
                const parsed = Number(event.target.value.replace(",", "."))
                if (!(parsed > 0)) return
                commit({ ...playback, fit: "manual", targetDuration: parsed }, "discrete")
              }}
            />
          ) : null}
        </div>
      </div>

      {overrun ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-[0.7rem] text-amber-900 dark:text-amber-100">
          {voiceOverrunMessage(overrun)}
        </p>
      ) : null}
      <Button type="button" size="xs" variant="outline" className="self-start" onClick={onApplyFit} disabled={!suggestion}>
        Ajustar ao áudio
      </Button>
    </div>
  )
}

function FitButton({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "rounded-md border px-2 py-1 text-[0.7rem]",
        selected ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
