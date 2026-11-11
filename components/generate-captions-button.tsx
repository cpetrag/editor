"use client"

import { useState } from "react"
import { Captions } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { AiRequestError, requestCaptions } from "@/lib/ai-client"
import { placeSlicedCaptionLines } from "@/lib/audio/captions"
import {
  DEFAULT_GROUP_OPTIONS,
  parseMaxWords,
  type CaptionLine,
} from "@/lib/captions"

interface GenerateCaptionsButtonProps {
  duration: number
  disabled: boolean
  loadMedia: () => Promise<File | null>
  onGenerate: (
    lines: CaptionLine[],
    warnings: string[],
    voice?: { id: string; start: number } | null,
  ) => void
  onStatus?: (message: string) => void
  voiceTrack?: { id?: string; start: number; trimIn: number } | null
  loadVoice?: () => Promise<File | null>
  vocabulary?: readonly string[]
  maxWords?: number
  hideSlider?: boolean
}

export function GenerateCaptionsButton({
  duration,
  disabled,
  loadMedia,
  onGenerate,
  onStatus,
  voiceTrack = null,
  loadVoice,
  vocabulary = [],
  maxWords: maxWordsProp,
  hideSlider = false,
}: GenerateCaptionsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [localMaxWords, setLocalMaxWords] = useState(DEFAULT_GROUP_OPTIONS.maxWords)
  const maxWords = maxWordsProp ?? localMaxWords
  const [source, setSource] = useState<"voice" | "video">(voiceTrack ? "voice" : "video")

  async function handleClick() {
    setLoading(true)
    onStatus?.("Transcrevendo…")
    try {
      const useVoice = Boolean(voiceTrack && loadVoice && source === "voice")
      const media = useVoice ? await loadVoice?.() : await loadMedia()
      if (!media) {
        onStatus?.(useVoice ? "Não achei o arquivo da locução." : "Carregue um vídeo.")
        return
      }
      const payload = await requestCaptions({ duration, media, maxWords, vocabulary })
      const lines =
        useVoice && voiceTrack ? placeSlicedCaptionLines(payload.lines, voiceTrack) : payload.lines
      onGenerate(
        lines,
        payload.warnings,
        useVoice && voiceTrack?.id ? { id: voiceTrack.id, start: voiceTrack.start } : null,
      )
      onStatus?.(
        payload.warnings.includes("words-estimated")
          ? "Legendas prontas. Timing estimado."
          : "Legendas prontas",
      )
    } catch (caught) {
      console.error("[editor] falha ao gerar legendas", caught)
      const message =
        caught instanceof AiRequestError
          ? caught.message
          : "Não foi possível transcrever o áudio."
      onStatus?.(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-w-[11rem] flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => {
          void handleClick()
        }}
        className="border-brand/40 text-brand hover:bg-brand/10 hover:text-brand"
      >
        {loading ? <Spinner data-icon="inline-start" /> : <Captions data-icon="inline-start" />}
        Gerar legendas
      </Button>
      {voiceTrack && loadVoice ? (
        <div className="flex gap-2 text-[0.65rem] text-muted-foreground">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="caption-source"
              checked={source === "voice"}
              onChange={() => setSource("voice")}
            />
            Locução
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="caption-source"
              checked={source === "video"}
              onChange={() => setSource("video")}
            />
            Áudio do vídeo
          </label>
        </div>
      ) : null}
      {hideSlider ? null : (
        <Field className="gap-1">
          <FieldLabel htmlFor="caption-max-words" className="text-[0.65rem] text-muted-foreground">
            Palavras por card
            <span className="ml-1 font-mono tabular-nums text-foreground">{maxWords}</span>
          </FieldLabel>
          <input
            id="caption-max-words"
            type="range"
            min={1}
            max={6}
            step={1}
            value={maxWords}
            disabled={disabled || loading}
            onChange={(event) => setLocalMaxWords(parseMaxWords(event.target.value))}
            className="h-5 w-full accent-brand"
          />
        </Field>
      )}
    </div>
  )
}
