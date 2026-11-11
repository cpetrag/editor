import { parseDuration } from "@/lib/ai-generate"
import { getOpenAiApiKey, punctuateCaptionTokens, transcribeCaptionWords } from "@/lib/ai-openai"
import { AI_FAILURE_STATUS, WHISPER_MAX_BYTES } from "@/lib/ai-schema"
import { parseMaxWords, runCaptionsPipeline } from "@/lib/captions"
import { vocabularyPrompt } from "@/lib/caption-vocab"

export const runtime = "nodejs"
export const maxDuration = 90

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "missing-key") {
    return "IA não configurada no servidor."
  }
  if (error instanceof Error && error.message === "captions-empty") {
    return "Não encontramos fala no áudio."
  }
  return "Não foi possível transcrever o áudio."
}

export async function POST(req: Request): Promise<Response> {
  if (!getOpenAiApiKey()) {
    return Response.json({ error: "IA não configurada no servidor." }, { status: 503 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Formulário inválido" }, { status: 400 })
  }

  const duration = parseDuration(form.get("duration"))
  const maxWords = parseMaxWords(form.get("maxWords"))
  const vocabularyRaw = form.get("vocabulary")
  let vocabulary: string[] = []
  if (typeof vocabularyRaw === "string" && vocabularyRaw.trim()) {
    try {
      const parsed = JSON.parse(vocabularyRaw) as unknown
      if (Array.isArray(parsed)) {
        vocabulary = parsed.filter((item): item is string => typeof item === "string").slice(0, 40)
      }
    } catch {
      vocabulary = []
    }
  }
  const media = form.get("media")
  const file = media instanceof File && media.size > 0 ? media : null
  if (!file) {
    return Response.json({ error: "Carregue um vídeo." }, { status: 400 })
  }
  if (file.size > WHISPER_MAX_BYTES) {
    return Response.json({ error: "Arquivo acima de 25 MB." }, { status: 400 })
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = await runCaptionsPipeline(
      { duration, mediaBytes: file.size, maxWords },
      {
        transcribe: () =>
          transcribeCaptionWords(
            bytes,
            file.type,
            file.name || "audio.mp4",
            vocabularyPrompt(vocabulary),
          ),
        punctuate: (words) => punctuateCaptionTokens(words),
      },
    )
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : error
    console.error("[editor] falha em /api/ai/captions", message)
    if (error instanceof Error && error.message === "missing-key") {
      return Response.json({ error: errorMessage(error) }, { status: 503 })
    }
    if (error instanceof Error && error.message === "captions-empty") {
      return Response.json({ error: errorMessage(error) }, { status: 422 })
    }
    return Response.json({ error: errorMessage(error) }, { status: AI_FAILURE_STATUS })
  }
}
