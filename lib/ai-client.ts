import type { GeneratePipelineResult } from "./ai-generate.ts"
import { WHISPER_MAX_BYTES } from "./ai-schema.ts"
import { parseMaxWords, type CaptionLine } from "./captions.ts"

const FETCH_MS = 90_000

export class AiRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AiRequestError"
    this.status = status
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const json = (await response.json()) as { error?: string }
    if (json.error) return json.error
  } catch {
    /* ignore */
  }
  if (response.status === 503) return "IA não configurada no servidor."
  return fallback
}

export async function requestGenerate(input: {
  prompt: string
  duration: number
  media?: File | null
}): Promise<GeneratePipelineResult> {
  const body = new FormData()
  body.set("prompt", input.prompt)
  body.set("duration", String(input.duration))
  if (input.media) body.set("media", input.media, input.media.name || "video.mp4")

  const response = await fetch("/api/ai/generate", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  })
  if (!response.ok) {
    throw new AiRequestError(
      await readError(response, "Falha ao gerar estrutura"),
      response.status,
    )
  }
  return (await response.json()) as GeneratePipelineResult
}

export async function requestCaptions(input: {
  duration: number
  media: File
  maxWords?: number
}) {
  if (input.media.size > WHISPER_MAX_BYTES) {
    throw new AiRequestError("Arquivo acima de 25 MB.", 400)
  }
  const body = new FormData()
  body.set("duration", String(input.duration))
  body.set("maxWords", String(parseMaxWords(input.maxWords)))
  body.set("media", input.media, input.media.name || "video.mp4")
  const response = await fetch("/api/ai/captions", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  })
  if (!response.ok) {
    throw new AiRequestError(
      await readError(response, "Não foi possível transcrever o áudio."),
      response.status,
    )
  }
  return (await response.json()) as { lines: CaptionLine[]; warnings: string[] }
}

export async function requestHooks(prompt: string): Promise<string[]> {
  const response = await fetch("/api/ai/hooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(FETCH_MS),
  })
  if (!response.ok) {
    throw new AiRequestError(
      await readError(response, "Não foi possível sugerir ganchos."),
      response.status,
    )
  }
  const json = (await response.json()) as { hooks?: string[] }
  return Array.isArray(json.hooks) ? json.hooks : []
}

export function pngFileFromBase64(pngBase64: string): File {
  const binary = atob(pngBase64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], "ia-sticker.png", { type: "image/png" })
}
