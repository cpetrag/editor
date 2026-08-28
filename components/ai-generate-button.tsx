"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { AiRequestError, requestGenerate } from "@/lib/ai-client"
import type { GeneratePipelineResult } from "@/lib/ai-generate"

interface AIGenerateButtonProps {
  duration: number
  loadMedia: () => Promise<File | null>
  onGenerate: (payload: GeneratePipelineResult) => void | Promise<void>
  onStatus?: (message: string) => void
}

export function AIGenerateButton({
  duration,
  loadMedia,
  onGenerate,
  onStatus,
}: AIGenerateButtonProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleGenerate() {
    setLoading(true)
    setError("")
    let media: File | null = null
    try {
      media = await loadMedia()
    } catch (loadError) {
      console.error("[editor] falha ao ler o vídeo para a IA", loadError)
    }

    const phases = media
      ? ["Transcrevendo…", "Montando inserts…", "Gerando PNG…"]
      : ["Montando inserts…", "Gerando PNG…"]
    let phaseIndex = 0
    onStatus?.(phases[0] ?? "Montando inserts…")
    const timer = window.setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, phases.length - 1)
      onStatus?.(phases[phaseIndex] ?? "Gerando PNG…")
    }, 8000)

    try {
      const payload = await requestGenerate({ prompt, duration, media })
      await onGenerate(payload)
      const imageFailed = payload.warnings.includes("image-failed")
      onStatus?.(imageFailed ? "Estrutura pronta. PNG não gerado." : "Estrutura pronta")
      setOpen(false)
      setPrompt("")
    } catch (caught) {
      console.error("[editor] falha ao gerar inserts com IA", caught)
      const message =
        caught instanceof AiRequestError
          ? caught.message
          : "Falha ao gerar estrutura"
      setError(message)
      onStatus?.(message)
    } finally {
      window.clearInterval(timer)
      setLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="border-brand/40 text-brand hover:bg-brand/10 hover:text-brand"
          >
            <Sparkles data-icon="inline-start" />
            Gerar com IA
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand/15 text-brand">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Gerar estrutura com IA
              </p>
              <p className="text-xs text-muted-foreground">
                Descreva o produto ou a campanha.
              </p>
            </div>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Promoção de fraldas, frete grátis, focar na urgência..."
            rows={4}
            disabled={loading}
            className="resize-none text-sm"
          />

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}

          <Button
            onClick={() => {
              void handleGenerate()
            }}
            disabled={loading || !prompt.trim()}
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles data-icon="inline-start" />
                {error ? "Tentar de novo" : "Gerar Estrutura"}
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
