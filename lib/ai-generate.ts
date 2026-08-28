import { PLACEHOLDER_DURATION, clampInsert } from "./composition.ts"
import { createStickerInsert, type Insert } from "./inserts.ts"
import { aiInsertToInsert } from "./ai-prompt.ts"
import {
  IMAGE_ALPHA_SUFFIX,
  WHISPER_MAX_BYTES,
  sanitizeAiInserts,
  type AiInsertDraft,
  type GenerateWarning,
  type StickerHint,
} from "./ai-schema.ts"

export function parseDuration(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw)
  return value > 0 && Number.isFinite(value) ? value : PLACEHOLDER_DURATION
}

export function defaultStickerHint(duration: number): StickerHint {
  const safe = duration > 0 ? duration : PLACEHOLDER_DURATION
  return {
    start: Math.min(3, safe / 3),
    duration: 4,
    position: "bottom",
  }
}

export function buildImagePrompt(userPrompt: string, inserts: AiInsertDraft[]): string {
  const offer = inserts.find(
    (insert) =>
      (insert.type === "alerta-desconto" || insert.type === "cupom") &&
      typeof insert.text === "string" &&
      insert.text.trim(),
  )
  const offerText = offer?.text?.trim() ?? ""
  const parts = [
    userPrompt.trim(),
    offerText,
    "Shopee affiliate palette #EE4D2D #FFD427.",
    IMAGE_ALPHA_SUFFIX,
  ].filter(Boolean)
  return parts.join(" ")
}

export interface GeneratePipelineInput {
  prompt: string
  duration: number
  mediaBytes?: number
}

export interface GeneratePipelineDeps {
  transcribe: () => Promise<string>
  complete: (transcript: string | null) => Promise<{
    inserts: unknown
    stickerHint?: StickerHint
  }>
  generatePng: (imagePrompt: string) => Promise<string>
}

export interface GeneratePipelineResult {
  inserts: AiInsertDraft[]
  stickerHint?: StickerHint
  pngBase64?: string
  warnings: GenerateWarning[]
}

export async function runGeneratePipeline(
  input: GeneratePipelineInput,
  deps: GeneratePipelineDeps,
): Promise<GeneratePipelineResult> {
  const warnings: GenerateWarning[] = []
  let transcript: string | null = null

  if (!input.mediaBytes || input.mediaBytes <= 0) {
    warnings.push("transcript-skipped")
  } else if (input.mediaBytes > WHISPER_MAX_BYTES) {
    warnings.push("transcript-failed")
  } else {
    try {
      transcript = await deps.transcribe()
    } catch {
      warnings.push("transcript-failed")
    }
  }

  const completed = await deps.complete(transcript)
  const inserts = sanitizeAiInserts(completed.inserts)
  const stickerHint = completed.stickerHint ?? defaultStickerHint(input.duration)
  const imagePrompt = buildImagePrompt(input.prompt, inserts)

  let pngBase64: string | undefined
  try {
    pngBase64 = await deps.generatePng(imagePrompt)
  } catch {
    warnings.push("image-failed")
  }

  return { inserts, stickerHint, pngBase64, warnings }
}

export function assembleInserts(input: {
  inserts: AiInsertDraft[]
  stickerHint?: StickerHint
  duration: number
  sticker?: { fileId: string; label: string }
}): Insert[] {
  const duration = parseDuration(input.duration)
  const chips = sanitizeAiInserts(input.inserts).map((raw) =>
    clampInsert(aiInsertToInsert(raw), duration),
  )
  if (!input.sticker) return chips
  const hint = input.stickerHint ?? defaultStickerHint(duration)
  const sticker = createStickerInsert({
    sourceKind: "upload",
    label: input.sticker.label,
    fileId: input.sticker.fileId,
  })
  sticker.start = hint.start
  sticker.duration = hint.duration
  sticker.anchor = hint.position
  return [...chips, clampInsert(sticker, duration)]
}
