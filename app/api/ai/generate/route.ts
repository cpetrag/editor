import {
  parseDuration,
  runGeneratePipeline,
} from "@/lib/ai-generate"
import { getOpenAiApiKey, completeInserts, generateTransparentPng, transcribeMedia } from "@/lib/ai-openai"
import { AI_FAILURE_STATUS } from "@/lib/ai-schema"

export const runtime = "nodejs"
export const maxDuration = 90

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "missing-key") {
    return "IA não configurada no servidor."
  }
  return "Não foi possível montar a estrutura."
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

  const prompt = String(form.get("prompt") ?? "").trim()
  if (!prompt) {
    return Response.json({ error: "Descreva o produto." }, { status: 400 })
  }

  const duration = parseDuration(form.get("duration"))
  const media = form.get("media")
  const file = media instanceof File && media.size > 0 ? media : null
  const mediaBytes = file ? file.size : undefined
  const mediaBuffer = file ? new Uint8Array(await file.arrayBuffer()) : null

  try {
    const result = await runGeneratePipeline(
      { prompt, duration, mediaBytes },
      {
        transcribe: async () => {
          if (!mediaBuffer || !file) throw new Error("transcript-failed")
          return transcribeMedia(mediaBuffer, file.type, file.name || "audio.mp4")
        },
        complete: async (transcript) => completeInserts({ prompt, transcript, duration }),
        generatePng: (imagePrompt) => generateTransparentPng(imagePrompt),
      },
    )
    if (result.inserts.length === 0) {
      return Response.json(
        { error: "Não foi possível montar a estrutura." },
        { status: AI_FAILURE_STATUS },
      )
    }
    return Response.json(result)
  } catch (error) {
    console.error("[editor] falha em /api/ai/generate", error instanceof Error ? error.message : error)
    const status = error instanceof Error && error.message === "missing-key" ? 503 : AI_FAILURE_STATUS
    return Response.json({ error: errorMessage(error) }, { status })
  }
}
