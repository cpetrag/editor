import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"

import { IA_SYSTEM_PROMPT } from "./ai-prompt.ts"
import {
  openaiGenerateSchema,
  openaiHooksSchema,
  type GenerateModel,
  type StickerHint,
} from "./ai-schema.ts"
import { WHISPER_CAPTION_REQUEST, type WhisperCaptionPayload } from "./captions.ts"

export function getOpenAiApiKey(): string | null {
  const key = String(process.env.OPENAI_API_KEY ?? "").trim()
  return key || null
}

function textModel(): string {
  return String(process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini").trim() || "gpt-4o-mini"
}

function imageModel(): string {
  return String(process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5").trim() || "gpt-image-1.5"
}

function transcribeModel(): string {
  return String(process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1").trim() || "whisper-1"
}

export async function transcribeMedia(
  bytes: Uint8Array,
  mime: string,
  filename: string,
): Promise<string> {
  const key = getOpenAiApiKey()
  if (!key) throw new Error("missing-key")
  const body = new FormData()
  body.set("model", transcribeModel())
  body.set("file", new Blob([bytes], { type: mime || "application/octet-stream" }), filename)
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  })
  if (!response.ok) {
    throw new Error("transcript-failed")
  }
  const json = (await response.json()) as { text?: string }
  return String(json.text ?? "").trim()
}

export async function transcribeCaptionWords(
  bytes: Uint8Array,
  mime: string,
  filename: string,
): Promise<WhisperCaptionPayload> {
  const key = getOpenAiApiKey()
  if (!key) throw new Error("missing-key")
  const body = new FormData()
  body.set("model", transcribeModel())
  body.set("file", new Blob([bytes], { type: mime || "application/octet-stream" }), filename)
  body.set("response_format", WHISPER_CAPTION_REQUEST.responseFormat)
  body.set("timestamp_granularities[]", WHISPER_CAPTION_REQUEST.timestampGranularity)
  body.set("language", "pt")
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  })
  if (!response.ok) {
    throw new Error("transcript-failed")
  }
  return (await response.json()) as WhisperCaptionPayload
}

function toGenerateModel(object: {
  inserts: Array<{
    type: string
    start: number
    duration: number
    position: StickerHint["position"] | null
    animIn: string | null
    animOut: string | null
    text: string | null
  }>
  stickerHint: StickerHint | null
}): GenerateModel {
  return {
    inserts: object.inserts.map((insert) => ({
      type: insert.type,
      start: insert.start,
      duration: insert.duration,
      ...(insert.position ? { position: insert.position } : {}),
      ...(insert.animIn ? { animIn: insert.animIn } : {}),
      ...(insert.animOut ? { animOut: insert.animOut } : {}),
      ...(insert.text ? { text: insert.text } : {}),
    })),
    ...(object.stickerHint ? { stickerHint: object.stickerHint } : {}),
  }
}

export async function completeInserts(input: {
  prompt: string
  transcript: string | null
  duration: number
}): Promise<GenerateModel> {
  const key = getOpenAiApiKey()
  if (!key) throw new Error("missing-key")
  const user = [
    `Duração do vídeo: ${input.duration}s.`,
    input.transcript
      ? `Transcrição do áudio:\n${input.transcript}`
      : "Sem transcrição de áudio.",
    `Pedido do operador:\n${input.prompt}`,
  ].join("\n\n")

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { object } = await generateObject({
        model: openai(textModel()),
        schema: openaiGenerateSchema,
        system: IA_SYSTEM_PROMPT,
        prompt: user,
      })
      return toGenerateModel(object)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("json-invalid")
}

export async function completeHooks(prompt: string): Promise<string[]> {
  const key = getOpenAiApiKey()
  if (!key) throw new Error("missing-key")
  const { object } = await generateObject({
    model: openai(textModel()),
    schema: openaiHooksSchema,
    system:
      "Você escreve ganchos curtos em português do Brasil para anúncios verticais de afiliado. Sem aspas, sem numeração, sem markdown. Tom urgente e falado.",
    prompt: `Gere exatamente 4 ganchos para: ${prompt}`,
  })
  return object.hooks
}

export async function generateTransparentPng(imagePrompt: string): Promise<string> {
  const key = getOpenAiApiKey()
  if (!key) throw new Error("missing-key")
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: imageModel(),
      prompt: imagePrompt,
      background: "transparent",
      output_format: "png",
      size: "1024x1536",
      n: 1,
    }),
  })
  if (!response.ok) {
    throw new Error("image-failed")
  }
  const json = (await response.json()) as { data?: Array<{ b64_json?: string }> }
  const pngBase64 = json.data?.[0]?.b64_json
  if (!pngBase64) throw new Error("image-failed")
  return pngBase64
}
