import { buildReadyInsert } from "../content/gallery.ts"
import type { CompositionInsert } from "../composition.ts"
import { retentionZones, type RetentionCuts } from "../insert-ops.ts"
import { insertPaintRect, rectsIntersect } from "../paint/bounds.ts"
import { shapeQuoteInsert } from "./quote-fit.ts"
import type { ProofCard, ShopeeInsertSource } from "./types.ts"

const GAP = 0.1
const STATS_DURATION = 2.5
const QUOTE_DURATION = 3.4
function tenth(value: number): number {
  return Math.round(value * 10) / 10
}

function tenthDown(value: number): number {
  return Math.floor(value * 10 + 1e-6) / 10
}

function tenthUp(value: number): number {
  return Math.ceil((value - 1e-6) * 10) / 10
}

function blocks(existing: CompositionInsert, draft: CompositionInsert, start: number, duration: number): boolean {
  const time = existing.start < start + duration - 1e-3 && start < existing.start + existing.duration - 1e-3
  if (!time) return false
  if (existing.kind === "caption" || existing.type === "legenda") return (draft.y ?? 50) > 64
  const drawn = insertPaintRect(existing)
  const next = insertPaintRect(draft)
  if (!drawn || !next) return Math.abs((existing.y ?? 50) - (draft.y ?? 50)) < 16
  return rectsIntersect(drawn, next)
}

function durationOf(field: ProofCard["field"]): number {
  return field === "quote" ? QUOTE_DURATION : STATS_DURATION
}

/**
 * Monta nota/vendidos e a citação em sequência dentro da janela PROVA.
 * Se um insert da mesma faixa da tela ainda está na tela, o próximo começa depois dele.
 */
export function placeProofInserts(
  cards: ProofCard[],
  existing: CompositionInsert[],
  videoDuration: number,
  cuts?: RetentionCuts | null,
  fetchedAt = "",
  limitEnd?: number,
): CompositionInsert[] {
  const wanted = cards.filter((card) => card.field === "rating" || card.field === "sold" || card.field === "quote").slice(0, 2)
  if (wanted.length === 0) return []
  const zones = retentionZones(Math.max(videoDuration, 0), cuts)
  const prova = zones.find((zone) => zone.id === "prova") ?? zones[0]
  const windowStart = prova?.from ?? 0
  const windowEnd = Math.min(prova?.to ?? videoDuration, limitEnd && limitEnd > 0 ? limitEnd : videoDuration)
  if (!(windowEnd > windowStart)) return []
  const placed: CompositionInsert[] = []
  const occupied = [...existing]
  let cursor = windowStart
  for (const card of wanted) {
    const source: ShopeeInsertSource = {
      kind: "shopee",
      field: card.field,
      fetchedAt,
      snapshot: card.snapshot,
      ...(card.reviewId ? { reviewId: card.reviewId } : {}),
      ...(card.pasted ? { pasted: true } : {}),
    }
    let draft = buildReadyInsert(
      {
        text: card.text,
        styleId: card.styleId,
        packId: "flutuar",
        y: card.y,
        source,
        role: "prova",
      },
      cursor,
      windowEnd > 0 ? windowEnd : cursor + 3,
    )
    if (card.field === "quote" || draft.text.includes("\n")) draft = shapeQuoteInsert(draft)
    const y = draft.y ?? card.y
    let start = cursor
    let guard = 0
    while (guard < 12 && occupied.some((insert) => blocks(insert, draft, start, durationOf(card.field)))) {
      const blocker = occupied.find((insert) => blocks(insert, draft, start, durationOf(card.field)))
      if (!blocker) break
      start = tenthUp(blocker.start + blocker.duration)
      guard += 1
    }
    if (start + 0.5 > windowEnd) break
    let duration = durationOf(card.field)
    if (start + duration > windowEnd) duration = tenthDown(windowEnd - start)
    if (duration < 0.5) break
    draft = { ...draft, y, start: tenth(start), duration: tenth(duration) }
    placed.push(draft)
    occupied.push(draft)
    cursor = tenth(draft.start + draft.duration + GAP)
  }
  return placed
}
