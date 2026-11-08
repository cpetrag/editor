import type { CompositionInsert as Insert, InsertType } from "./composition.ts"
import { isChipInsert } from "./composition.ts"

const TYPE_ORDER: InsertType[] = [
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
]

const TYPE_LABELS: Record<InsertType, string> = {
  "logo-shopee": "Logo Shopee",
  "selo-frete": "Selo Frete Grátis",
  "alerta-desconto": "Alerta de Desconto",
  "preco-riscado": "Preço Riscado",
  cupom: "Selo de Cupom",
  contador: "Contador Regressivo",
  "barra-estoque": "Barra de Estoque",
  estrelas: "Avaliação (estrelas)",
  seta: "Seta Animada",
  "tarja-frete": "Tarja de Frete",
  "seta-mao": "Seta à mão",
  "circulo-destaque": "Círculo de destaque",
  "bubble-comentario": "Comentário TikTok",
  "divisor-antes-depois": "Divisor antes/depois",
  passo: "Passo 1 de 3",
  "tarja-espera": "Espera até o final",
  "texto-livre": "Texto",
  "sticker-png": "Insert PNG",
  legenda: "Legenda",
}

export type RetentionBucket = "gancho" | "prova" | "cta"

export const ZONE_ORDER: RetentionBucket[] = ["gancho", "prova", "cta"]

export const ZONE_LABELS: Record<RetentionBucket, string> = {
  gancho: "Gancho",
  prova: "Prova",
  cta: "CTA",
}

const ZONE_COLORS: Record<RetentionBucket, string> = {
  gancho: "var(--track-desconto)",
  prova: "var(--track-frete)",
  cta: "var(--brand)",
}

export interface RetentionSpan {
  id: RetentionBucket
  label: string
  from: number
  to: number
  color: string
}

/** Cortes da régua. Sem isso, as faixas seguem 15% / 70%. */
export type RetentionCuts = { ganchoEnd: number; ctaStart: number }

/** Contiguous Gancho / Prova / CTA covering 100% of the video. */
export function retentionZones(total: number, cuts?: RetentionCuts | null): RetentionSpan[] {
  const duration = Math.max(0, total)
  if (cuts && duration > 0) {
    const ganchoEnd = Math.min(duration, Math.max(0, cuts.ganchoEnd))
    const ctaStart = Math.min(duration, Math.max(ganchoEnd, cuts.ctaStart))
    return [
      { id: "gancho", label: ZONE_LABELS.gancho, from: 0, to: ganchoEnd, color: ZONE_COLORS.gancho },
      { id: "prova", label: ZONE_LABELS.prova, from: ganchoEnd, to: ctaStart, color: ZONE_COLORS.prova },
      { id: "cta", label: ZONE_LABELS.cta, from: ctaStart, to: duration, color: ZONE_COLORS.cta },
    ]
  }
  const ganchoEnd = duration * 0.15
  const provaEnd = duration * 0.7
  return [
    { id: "gancho", label: ZONE_LABELS.gancho, from: 0, to: ganchoEnd, color: ZONE_COLORS.gancho },
    { id: "prova", label: ZONE_LABELS.prova, from: ganchoEnd, to: provaEnd, color: ZONE_COLORS.prova },
    { id: "cta", label: ZONE_LABELS.cta, from: provaEnd, to: duration, color: ZONE_COLORS.cta },
  ]
}

export function zoneForInsert(insert: Insert, total: number): RetentionBucket {
  const zones = retentionZones(total)
  const mid = insert.start + insert.duration / 2
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i]
    if (!zone) continue
    const last = i === zones.length - 1
    if (last ? mid >= zone.from : mid >= zone.from && mid < zone.to) {
      return zone.id
    }
  }
  return "cta"
}

export function nextInsertStart(playhead: number, videoDuration: number): number {
  const time = Math.max(0, playhead)
  if (!(videoDuration > 0)) return time
  return Math.min(time, Math.max(0, videoDuration - 1))
}

export function nextInsertType(existing: Insert[]): InsertType {
  const chips = existing.filter(isChipInsert)
  if (chips.length === 0) return TYPE_ORDER[0]
  const last = chips[chips.length - 1]?.type ?? TYPE_ORDER[0]
  const index = TYPE_ORDER.indexOf(last)
  return TYPE_ORDER[(index + 1) % TYPE_ORDER.length]
}

export function insertLabel(insert: Insert): string {
  const text = insert.text?.trim()
  if (text) return text
  if (insert.label?.trim()) return insert.label.trim()
  return TYPE_LABELS[insert.type]
}

export function sortInsertsByStart(inserts: Insert[]): Insert[] {
  return inserts.slice().sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
}

export function duplicateKey(insert: Insert): string {
  return [
    insert.type,
    insert.start,
    insert.duration,
    insert.anchor,
    insert.text ?? "",
  ].join("\0")
}

export function findDuplicateGroups(inserts: Insert[]): { ids: string[] }[] {
  const map = new Map<string, string[]>()
  for (const insert of inserts) {
    if (!isChipInsert(insert)) continue
    const key = duplicateKey(insert)
    const ids = map.get(key) ?? []
    ids.push(insert.id)
    map.set(key, ids)
  }
  return [...map.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => ({ ids }))
}

export function mergeDuplicateGroup(inserts: Insert[], ids: string[]): Insert[] {
  const drop = new Set(ids.slice(1))
  return inserts.filter((insert) => !drop.has(insert.id))
}

export function overflowingInserts(inserts: Insert[], videoDuration: number, fps = 30): Insert[] {
  if (!(videoDuration > 0)) return []
  const slack = fps > 0 ? 1 / fps : 1e-6
  return inserts.filter((insert) => insert.start + insert.duration > videoDuration + slack)
}

export function stackLanes(inserts: Insert[]): Map<string, number> {
  const sorted = [...inserts].sort(
    (a, b) => a.start - b.start || a.duration - b.duration,
  )
  const laneEnds: number[] = []
  const lanes = new Map<string, number>()
  for (const insert of sorted) {
    let lane = laneEnds.findIndex((end) => end <= insert.start + 1e-6)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(insert.start + insert.duration)
    } else {
      laneEnds[lane] = insert.start + insert.duration
    }
    lanes.set(insert.id, lane)
  }
  return lanes
}

export function estimateBatch(count: number): { seconds: number; megabytes: number } {
  return {
    seconds: count * 8,
    megabytes: count * 5,
  }
}

export function isInsertActiveAt(
  insert: Pick<Insert, "start" | "duration">,
  time: number,
): boolean {
  return time >= insert.start && time < insert.start + insert.duration
}

/** Returns the insert start when the playhead is outside the clip; otherwise null. */
export function seekTimeForInsert(
  time: number,
  insert: Pick<Insert, "start" | "duration">,
): number | null {
  if (isInsertActiveAt(insert, time)) return null
  return insert.start
}

export function applyVariationPreview(
  inserts: Insert[],
  position: Insert["anchor"],
): Insert[] {
  return inserts.map((insert) =>
    isChipInsert(insert) ? { ...insert, anchor: position } : insert,
  )
}
