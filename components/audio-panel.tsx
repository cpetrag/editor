"use client"

import { useEffect, useRef, useState } from "react"
import { Music2, Mic, Zap, Volume2, VolumeX, Play, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { audioSummary } from "@/lib/audio/summary"
import {
  AUDIO_ACCEPT,
  MAX_AUDIO_TRACKS,
  MAX_VOICE_TRACKS,
  type AudioKind,
  type AudioTrack,
  type CompositionAudio,
} from "@/lib/audio/types"
import { guessAudioKind, audioFileError } from "@/lib/audio/upload"
import { usableLength } from "@/lib/audio/range"
import { isMixSilent } from "@/lib/audio/place"
import { parseDecimal } from "@/lib/parse-decimal"
import { formatPanelNumber } from "@/lib/panel-number"
import { formatTime } from "@/lib/inserts"
import { cn } from "@/lib/utils"

const KIND_LABEL: Record<AudioKind, string> = {
  music: "Música",
  voice: "Locução",
  sfx: "Efeito",
}

export function AudioPanel({
  audio,
  videoDuration,
  audioUrls,
  missingTrackIds,
  selectedTrackId,
  onChange,
  onBeginGesture,
  onEndGesture,
  onCommitFile,
  onImportingChange,
  onStatus,
}: {
  audio: CompositionAudio
  videoDuration: number
  audioUrls: Record<string, string>
  missingTrackIds: readonly string[]
  selectedTrackId: string | null
  onChange: (audio: CompositionAudio, mode: "discrete" | "gesture") => void
  onBeginGesture?: () => void
  onEndGesture?: () => void
  onCommitFile: (input: {
    file: File
    duration: number
    kind: AudioKind
    replaceTrackId?: string
    history?: "discrete" | "gesture"
    muteOriginal?: boolean
    peaks?: number[]
  }) => void | Promise<void>
  onImportingChange?: (importing: boolean) => void
  onStatus?: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const replaceId = useRef<string | null>(null)
  const replaceOriginal = useRef(false)
  const [importing, setImporting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(selectedTrackId)
  const [menuId, setMenuId] = useState<string | null>(null)
  const voiceCount = audio.tracks.filter((track) => track.kind === "voice").length

  useEffect(() => {
    onImportingChange?.(importing)
  }, [importing, onImportingChange])

  useEffect(() => {
    if (selectedTrackId) setExpandedId(selectedTrackId)
  }, [selectedTrackId])

  useEffect(() => {
    return () => {
      previewRef.current?.pause()
    }
  }, [])

  function patchTrack(id: string, patch: Partial<AudioTrack>, mode: "discrete" | "gesture") {
    onChange(
      {
        ...audio,
        tracks: audio.tracks.map((track) => (track.id === id ? { ...track, ...patch } : track)),
      },
      mode,
    )
  }

  function openPicker(trackId?: string) {
    replaceId.current = trackId ?? null
    if (replaceOriginal.current) {
      window.addEventListener(
        "focus",
        () => {
          window.setTimeout(() => {
            if (!replaceOriginal.current) return
            if ((inputRef.current?.files?.length ?? 0) > 0) return
            replaceOriginal.current = false
          }, 300)
        },
        { once: true },
      )
    }
    inputRef.current?.click()
  }

  async function onFile(file: File | undefined) {
    const replacing = replaceId.current
    const muteOriginal = replaceOriginal.current && !replacing
    replaceId.current = null
    replaceOriginal.current = false
    if (!file) return
    const error = audioFileError(file)
    if (error) {
      onStatus?.(error)
      return
    }
    if (!replacing && audio.tracks.length >= MAX_AUDIO_TRACKS) {
      onStatus?.("No máximo 4 faixas de áudio.")
      return
    }
    setImporting(true)
    try {
      const { inspectAudioBlob } = await import("@/lib/audio/decode")
      const inspected = await inspectAudioBlob(file)
      if (!(inspected.duration > 0)) {
        onStatus?.("Áudio não adicionado")
        return
      }
      const guessed = guessAudioKind(inspected.duration)
      if (!replacing && guessed === "voice" && voiceCount >= MAX_VOICE_TRACKS) {
        onStatus?.("Nesta versão cabe uma locução. A faixa entrou como efeito.")
      }
      const kind = replacing
        ? (audio.tracks.find((item) => item.id === replacing)?.kind ?? guessed)
        : guessed
      await onCommitFile({
        file,
        duration: inspected.duration,
        kind,
        peaks: inspected.peaks,
        ...(replacing ? { replaceTrackId: replacing } : { muteOriginal }),
      })
    } catch (caught) {
      console.error("[editor] falha ao ler áudio", caught)
      onStatus?.("Áudio não adicionado")
    } finally {
      setImporting(false)
    }
  }

  function playTrack(track: AudioTrack) {
    const url = audioUrls[track.fileId]
    if (!url) {
      onStatus?.("Arquivo de áudio ausente. Reenvie a faixa.")
      return
    }
    previewRef.current?.pause()
    const element = new Audio(url)
    element.currentTime = track.trimIn
    element.volume = Math.min(1, track.volume)
    previewRef.current = element
    const stopAt = window.setInterval(() => {
      if (element.currentTime >= track.trimOut - 0.05) {
        element.pause()
        window.clearInterval(stopAt)
      }
    }, 80)
    void element.play().catch((error: unknown) => {
      console.error("[editor] falha ao ouvir a faixa", error)
      window.clearInterval(stopAt)
    })
  }

  const showDucking =
    audio.tracks.some((track) => track.kind === "music") &&
    audio.tracks.some((track) => track.kind === "voice")

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          void onFile(file)
        }}
      />
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">Áudio do vídeo</span>
        <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
          {audio.original.muted ? "mudo" : `${Math.round(audio.original.volume * 100)}%`}
        </span>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={audio.original.muted ? "Ativar áudio do vídeo" : "Mutar áudio do vídeo"}
          aria-pressed={audio.original.muted}
          onClick={() =>
            onChange(
              { ...audio, original: { ...audio.original, muted: !audio.original.muted } },
              "discrete",
            )
          }
        >
          {audio.original.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
      </div>
      <GestureSlider
        label="Volume do áudio do vídeo"
        max={150}
        value={Math.round(audio.original.volume * 100)}
        onBegin={onBeginGesture}
        onEnd={onEndGesture}
        onChange={(next) =>
          onChange(
            { ...audio, original: { ...audio.original, volume: next / 100 } },
            "gesture",
          )
        }
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          replaceOriginal.current = true
          openPicker()
        }}
      >
        Substituir áudio
      </Button>
      {importing ? <p className="text-xs text-muted-foreground">Lendo o áudio…</p> : null}
      {isMixSilent(audio) ? (
        <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-xs text-foreground">
          O vídeo está sem som
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={audio.tracks.length >= MAX_AUDIO_TRACKS || importing}
        onClick={() => openPicker()}
      >
        + Adicionar áudio
      </Button>

      <ul className="flex flex-col gap-2">
        {audio.tracks.map((track) => {
          const missing = missingTrackIds.includes(track.id)
          const expanded = expandedId === track.id
          return (
            <li key={track.id} className="rounded-md border border-border">
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  onClick={() => setExpandedId(expanded ? null : track.id)}
                >
                  <KindIcon kind={track.kind} />
                  <span className="truncate text-xs text-foreground">{track.fileName}</span>
                  <span className="shrink-0 font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                    {formatTime(usableLength(track))}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label={track.muted ? "Ativar faixa" : "Mutar faixa"}
                  onClick={() => patchTrack(track.id, { muted: !track.muted }, "discrete")}
                >
                  {track.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </button>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Ouvir só esta faixa"
                  onClick={() => playTrack(track)}
                >
                  <Play className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Mais ações da faixa"
                  onClick={() => setMenuId(menuId === track.id ? null : track.id)}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </div>
              <KindPicker
                kind={track.kind}
                onChange={(kind) => {
                  if (kind === "voice" && track.kind !== "voice" && voiceCount >= MAX_VOICE_TRACKS) {
                    onStatus?.("Nesta versão cabe uma locução.")
                    return
                  }
                  patchTrack(track.id, { kind }, "discrete")
                }}
              />
              {menuId === track.id ? (
                <div className="flex flex-col border-t border-border p-1">
                  <MenuButton label="Substituir arquivo" onClick={() => { setMenuId(null); openPicker(track.id) }} />
                  <MenuButton
                    label="Duplicar"
                    onClick={() => {
                      setMenuId(null)
                      if (audio.tracks.length >= MAX_AUDIO_TRACKS) {
                        onStatus?.("No máximo 4 faixas de áudio.")
                        return
                      }
                      if (track.kind === "voice" && voiceCount >= MAX_VOICE_TRACKS) {
                        onStatus?.("Nesta versão cabe uma locução.")
                        return
                      }
                      const copy: AudioTrack = {
                        ...track,
                        id: crypto.randomUUID(),
                        start: Math.min(videoDuration, track.start + 0.25),
                      }
                      onChange({ ...audio, tracks: [...audio.tracks, copy] }, "discrete")
                    }}
                  />
                  <MenuButton
                    label="Remover"
                    onClick={() => {
                      setMenuId(null)
                      onChange(
                        { ...audio, tracks: audio.tracks.filter((item) => item.id !== track.id) },
                        "discrete",
                      )
                    }}
                  />
                </div>
              ) : null}
              <div className="px-2 pb-2">
                <GestureSlider
                  label={`Volume de ${track.fileName}`}
                  max={150}
                  value={Math.round(track.volume * 100)}
                  onBegin={onBeginGesture}
                  onEnd={onEndGesture}
                  onChange={(next) => patchTrack(track.id, { volume: next / 100 }, "gesture")}
                />
              </div>
              {missing ? (
                <div className="px-2 pb-2">
                  <Button type="button" size="xs" variant="outline" onClick={() => openPicker(track.id)}>
                    Reenviar arquivo
                  </Button>
                </div>
              ) : null}
              {expanded ? (
                <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
                  <SecondsField
                    label="Início (s)"
                    value={track.start}
                    onBegin={() => onBeginGesture?.()}
                    onEnd={() => onEndGesture?.()}
                    onChange={(start) => patchTrack(track.id, { start }, "gesture")}
                  />
                  <SecondsField
                    label="Fade in"
                    value={track.fadeIn}
                    onBegin={() => onBeginGesture?.()}
                    onEnd={() => onEndGesture?.()}
                    onChange={(fadeIn) => patchTrack(track.id, { fadeIn }, "gesture")}
                  />
                  <SecondsField
                    label="Fade out"
                    value={track.fadeOut}
                    onBegin={() => onBeginGesture?.()}
                    onEnd={() => onEndGesture?.()}
                    onChange={(fadeOut) => patchTrack(track.id, { fadeOut }, "gesture")}
                  />
                  <SecondsField
                    label="Corte início"
                    value={track.trimIn}
                    onBegin={() => onBeginGesture?.()}
                    onEnd={() => onEndGesture?.()}
                    onChange={(trimIn) => patchTrack(track.id, { trimIn }, "gesture")}
                  />
                  <SecondsField
                    label="Corte fim"
                    value={track.trimOut}
                    onBegin={() => onBeginGesture?.()}
                    onEnd={() => onEndGesture?.()}
                    onChange={(trimOut) => patchTrack(track.id, { trimOut }, "gesture")}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-brand"
                      checked={track.loop}
                      onChange={(event) => patchTrack(track.id, { loop: event.target.checked }, "discrete")}
                    />
                    Loop
                  </label>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {showDucking ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-brand"
              checked={audio.ducking.enabled}
              onChange={(event) =>
                onChange(
                  { ...audio, ducking: { ...audio.ducking, enabled: event.target.checked } },
                  "discrete",
                )
              }
            />
            Abaixar música quando houver voz
          </label>
          {audio.ducking.enabled ? (
            <label className="flex flex-col gap-1 text-[0.65rem] text-muted-foreground">
              Intensidade
              <span className="font-mono tabular-nums text-foreground">
                {Math.round(audio.ducking.amount * 100)}%
              </span>
              <GestureSlider
                label="Intensidade do ducking"
                max={100}
                value={Math.round(audio.ducking.amount * 100)}
                onBegin={onBeginGesture}
                onEnd={onEndGesture}
                onChange={(next) =>
                  onChange(
                    { ...audio, ducking: { ...audio.ducking, amount: next / 100 } },
                    "gesture",
                  )
                }
              />
            </label>
          ) : null}
        </div>
      ) : null}
      <p className="sr-only">{audioSummary(audio)}</p>
    </div>
  )
}

function GestureSlider({
  label,
  value,
  max,
  onBegin,
  onEnd,
  onChange,
}: {
  label: string
  value: number
  max: number
  onBegin?: () => void
  onEnd?: () => void
  onChange: (value: number) => void
}) {
  const dragging = useRef(false)
  const ownsGesture = useRef(false)

  function finish() {
    dragging.current = false
    if (!ownsGesture.current) return
    ownsGesture.current = false
    onEnd?.()
  }

  return (
    <input
      type="range"
      min={0}
      max={max}
      step={1}
      aria-label={label}
      value={value}
      className="h-5 w-full accent-brand"
      onPointerDown={(event) => {
        dragging.current = true
        ownsGesture.current = true
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch (error) {
          console.error("[editor] não foi possível capturar o slider", error)
        }
        onBegin?.()
        const end = () => {
          window.removeEventListener("pointerup", end)
          window.removeEventListener("pointercancel", end)
          finish()
        }
        window.addEventListener("pointerup", end)
        window.addEventListener("pointercancel", end)
      }}
      onBlur={() => {
        if (dragging.current || !ownsGesture.current) return
        ownsGesture.current = false
        onEnd?.()
      }}
      onChange={(event) => {
        if (!ownsGesture.current) ownsGesture.current = true
        onChange(Number(event.target.value))
      }}
    />
  )
}

function KindPicker({ kind, onChange }: { kind: AudioKind; onChange: (kind: AudioKind) => void }) {
  return (
    <div className="flex flex-wrap gap-1 px-2 pb-1" role="group" aria-label="Tipo da faixa">
      {(["music", "voice", "sfx"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={kind === option}
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[0.65rem]",
            kind === option ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
          )}
          onClick={() => onChange(option)}
        >
          {KIND_LABEL[option]}
        </button>
      ))}
    </div>
  )
}

function KindIcon({ kind }: { kind: AudioKind }) {
  const className = "size-3.5 shrink-0 text-muted-foreground"
  if (kind === "voice") return <Mic className={className} aria-hidden />
  if (kind === "sfx") return <Zap className={className} aria-hidden />
  return <Music2 className={className} aria-hidden />
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function SecondsField({
  label,
  value,
  onChange,
  onBegin,
  onEnd,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  onBegin?: () => void
  onEnd?: () => void
}) {
  const [draft, setDraft] = useState(formatPanelNumber(value))
  useEffect(() => {
    setDraft(formatPanelNumber(value))
  }, [value])
  return (
    <label className={cn("flex flex-col gap-1 text-[0.65rem] text-muted-foreground")}>
      {label}
      <input
        value={draft}
        inputMode="decimal"
        className="h-7 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground"
        onFocus={onBegin}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const parsed = parseDecimal(draft)
          if (parsed !== null) onChange(parsed)
          else setDraft(formatPanelNumber(value))
          onEnd?.()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
      />
    </label>
  )
}
