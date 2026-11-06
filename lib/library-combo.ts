import { insertKind, type CompositionInsert } from "./composition.ts"
import type { Template } from "./inserts.ts"

export type ComboEtapa = "gancho" | "prova" | "cta"
export type ComboEtapaFilter = "todos" | ComboEtapa

const SEAL_TYPES = new Set([
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
])

export function comboEtapa(template: Template): ComboEtapa {
  const track = template.beats?.[0]?.track
  if (track === "prova" || track === "cta" || track === "gancho") return track
  return "gancho"
}

export function comboMatchesEtapa(template: Template, filter: ComboEtapaFilter): boolean {
  if (filter === "todos") return true
  if (template.beats?.some((beat) => beat.track === filter)) return true
  return comboEtapa(template) === filter
}

export function comboMainText(template: Template): string {
  const beat = template.beats?.find((item) => item.kind === "text" && item.text?.trim())
  if (beat?.text?.trim()) return beat.text.trim()
  const insert = template.inserts.find((item) => item.text?.trim())
  return insert?.text?.trim() || template.name
}

export function comboContentSummary(template: Template): string {
  let texts = 0
  let seals = 0
  let pngs = 0
  const kinds = template.beats?.length
    ? template.beats.map((beat) => (beat.kind === "text" ? "texto-livre" : beat.elementId ?? "selo-frete"))
    : template.inserts.map((insert) => insert.type)
  for (const kind of kinds) {
    if (kind === "texto-livre" || kind === "legenda") texts += 1
    else if (kind === "sticker-png") pngs += 1
    else if (SEAL_TYPES.has(kind)) seals += 1
    else texts += 1
  }
  const parts: string[] = []
  if (texts) parts.push(`${texts} ${texts === 1 ? "texto" : "textos"}`)
  if (seals) parts.push(`${seals} ${seals === 1 ? "selo" : "selos"}`)
  if (pngs) parts.push(`${pngs} PNG`)
  return parts.join(" · ") || "vazio"
}

export function projectHasArtInserts(inserts: CompositionInsert[]): boolean {
  return inserts.some((insert) => insertKind(insert) !== "caption")
}
