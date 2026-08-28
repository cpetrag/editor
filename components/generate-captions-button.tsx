"use client"

import { useState } from "react"
import { Captions } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { AiRequestError, requestCaptions } from "@/lib/ai-client"
import {
  DEFAULT_GROUP_OPTIONS,
  parseMaxWords,
  type CaptionLine,
} from "@/lib/captions"

interface GenerateCaptionsButtonProps {
  duration: number
  disabled: boolean
  loadMedia: () => Promise<File | null>
  onGenerate: (lines: CaptionLine[], warnings: string[]) => void
  onStatus?: (message: string) => void
}

export function GenerateCaptionsButton({
  duration,
  disabled,
  loadMedia,
  onGenerate,
  onStatus,
}: GenerateCaptionsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [maxWords, setMaxWords] = useState(DEFAULT_GROUP_OPTIONS.maxWords)

  async function handleClick() {
    setLoading(true)
    onStatus?.("Transcrevendo…")
    try {
      const media = await loadMedia()
      if (!media) {
        onStatus?.("Carregue um vídeo.")
        return
      }
      const payload = await requestCaptions({ duration, media, maxWords })
      onGenerate(payload.lines, payload.warnings)
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
          onChange={(event) => setMaxWords(parseMaxWords(event.target.value))}
          className="h-5 w-full accent-brand"
        />
      </Field>
    </div>
  )
}
