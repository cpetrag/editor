import { z } from "zod"

import type { InsertAnchor, InsertType } from "./composition.ts"

export const WHISPER_MAX_BYTES = 25 * 1024 * 1024

export const IMAGE_ALPHA_SUFFIX =
  "Isolated cutout on a fully transparent background (alpha channel). PNG. No floor, no studio, no drop shadow, no 3D box, no extra scene. Subject centered. Do not fill the canvas with a solid color."

export const GENERATE_WARNINGS = [
  "transcript-skipped",
  "transcript-failed",
  "image-failed",
] as const

export type GenerateWarning = (typeof GENERATE_WARNINGS)[number]

export const ALLOWED_AI_TYPES = [
  "logo-shopee",
  "selo-frete",
  "alerta-desconto",
  "preco-riscado",
  "cupom",
  "contador",
  "barra-estoque",
  "estrelas",
  "seta",
  "tarja-frete",
  "seta-mao",
  "circulo-destaque",
  "bubble-comentario",
  "divisor-antes-depois",
  "passo",
  "tarja-espera",
  "texto-livre",
] as const satisfies readonly InsertType[]

const TYPE_ALIASES: Record<string, InsertType> = {
  "logo-shopee": "logo-shopee",
  "alerta-desconto": "alerta-desconto",
  "selo-cupom": "cupom",
  cupom: "cupom",
  contador: "contador",
  "prova-social": "estrelas",
  estrelas: "estrelas",
  "seta-animada": "seta",
  seta: "seta",
  "tarja-frete": "tarja-frete",
  "seta-mao": "seta-mao",
  "circulo-destaque": "circulo-destaque",
  "bubble-comentario": "bubble-comentario",
  "divisor-antes-depois": "divisor-antes-depois",
  passo: "passo",
  "tarja-espera": "tarja-espera",
  "selo-frete": "selo-frete",
  "preco-riscado": "preco-riscado",
  "barra-estoque": "barra-estoque",
  "texto-livre": "texto-livre",
}

export function resolveAiType(type: string): InsertType | null {
  if (type === "sticker-png") return null
  const resolved = TYPE_ALIASES[type]
  if (!resolved) return null
  if (!(ALLOWED_AI_TYPES as readonly string[]).includes(resolved)) return null
  return resolved
}

export const aiInsertSchema = z.object({
  type: z.string().min(1),
  start: z.number(),
  duration: z.number(),
  position: z.enum(["top", "center", "bottom"]).optional(),
  animIn: z.string().optional(),
  animOut: z.string().optional(),
  text: z.string().optional(),
  style: z.unknown().optional(),
})

export const stickerHintSchema = z.object({
  start: z.number(),
  duration: z.number(),
  position: z.enum(["top", "center", "bottom"]),
})

export const generateModelSchema = z.object({
  inserts: z.array(aiInsertSchema).max(8),
  stickerHint: stickerHintSchema.optional(),
})

/** OpenAI structured output rejects `.optional()`; use this with generateObject. */
export const openaiInsertSchema = z.object({
  type: z.string().min(1),
  start: z.number(),
  duration: z.number(),
  position: z.enum(["top", "center", "bottom"]).nullable(),
  animIn: z.string().nullable(),
  animOut: z.string().nullable(),
  text: z.string().nullable(),
})

export const openaiGenerateSchema = z.object({
  inserts: z.array(openaiInsertSchema).max(8),
  stickerHint: stickerHintSchema.nullable(),
})

export const openaiHooksSchema = z.object({
  hooks: z.array(z.string()).min(4).max(4),
})

export const hooksModelSchema = z.object({
  hooks: z.array(z.string()).min(1).max(8),
})

export type AiInsertDraft = z.infer<typeof aiInsertSchema>
export type StickerHint = z.infer<typeof stickerHintSchema>
export type GenerateModel = z.infer<typeof generateModelSchema>

export function sanitizeAiInserts(raw: unknown): AiInsertDraft[] {
  if (!Array.isArray(raw)) return []
  const kept: AiInsertDraft[] = []
  for (const item of raw) {
    const parsed = aiInsertSchema.safeParse(item)
    if (!parsed.success) continue
    const resolved = resolveAiType(parsed.data.type)
    if (!resolved) continue
    kept.push({ ...parsed.data, type: resolved })
  }
  return kept
}

export type { InsertAnchor }
