import { preserveCaptionWordTimings, type CaptionLine } from "./captions.ts"
import { insertKind, type CaptionWord, type CompositionInsert } from "./composition.ts"

export const DEFAULT_CAPTION_VOCABULARY = [
  "Natura",
  "Shopee",
  "Mercado Livre",
  "Amazon",
  "cupom",
  "frete grátis",
  "Saiba Mais",
  "link na bio",
]

const VOCAB_KEY = "editor.captionVocabulary"
const DEFAULT_STYLE_KEY = "editor.captionDefaultStyle"

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function applyVocabularyToText(text: string, vocabulary: readonly string[]): string {
  const terms = vocabulary.map((term) => term.trim()).filter(Boolean).sort((a, b) => b.length - a.length)
  let next = text
  for (const term of terms) {
    next = next.replace(new RegExp(escapeRegExp(term), "gi"), term)
  }
  return next
}

export function applyVocabularyToWords<T extends CaptionWord>(
  words: readonly T[],
  vocabulary: readonly string[],
): { words: T[]; text: string } {
  const titled = applyVocabularyToText(words.map((word) => word.text).join(" "), vocabulary)
  const tokens = titled.split(/\s+/).filter(Boolean)
  if (tokens.length !== words.length) {
    const next = words.map((word) => ({ ...word, text: applyVocabularyToText(word.text, vocabulary) }))
    return { words: next, text: next.map((word) => word.text).join(" ") }
  }
  const next = words.map((word, index) => ({ ...word, text: tokens[index]! }))
  return { words: next, text: titled }
}

export function applyVocabularyToLines(lines: readonly CaptionLine[], vocabulary: readonly string[]): CaptionLine[] {
  return lines.map((line) => {
    const titled = applyVocabularyToWords(line.words, vocabulary)
    return { ...line, text: titled.text, words: titled.words }
  })
}

export function vocabularyPrompt(vocabulary: readonly string[]): string {
  const terms = vocabulary.map((term) => term.trim()).filter(Boolean).slice(0, 12)
  const listed = terms.length > 0 ? ` ${terms.join(", ")}.` : ""
  return `Olá, tudo bem? Natura, Shopee e Mercado Livre.${listed} Cupom, frete grátis e Saiba Mais.`
}

export function countCaptionMatches(inserts: readonly CompositionInsert[], query: string): number {
  const needle = query.trim()
  if (!needle) return 0
  const pattern = new RegExp(escapeRegExp(needle), "gi")
  let count = 0
  for (const insert of inserts) {
    if (insertKind(insert) !== "caption") continue
    const matches = (insert.text ?? "").match(pattern)
    count += matches?.length ?? 0
  }
  return count
}

export function replaceCaptionText(
  inserts: readonly CompositionInsert[],
  query: string,
  replacement: string,
  mode: "one" | "all",
): { inserts: CompositionInsert[]; replaced: number } {
  const needle = query.trim()
  if (!needle) return { inserts: [...inserts], replaced: 0 }
  const pattern = new RegExp(escapeRegExp(needle), "gi")
  let remaining = mode === "one" ? 1 : Number.POSITIVE_INFINITY
  let replaced = 0
  const next = inserts.map((insert) => {
    if (insertKind(insert) !== "caption" || remaining <= 0) return insert
    const text = insert.text ?? ""
    const updated = text.replace(pattern, (found) => {
      if (remaining <= 0) return found
      remaining -= 1
      replaced += 1
      return replacement
    })
    if (updated === text) return insert
    return {
      ...insert,
      text: updated,
      words: preserveCaptionWordTimings(
        insert.words ?? [],
        updated,
        insert.start,
        insert.start + insert.duration,
      ),
    }
  })
  return { inserts: next, replaced }
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadCaptionVocabulary(): string[] {
  const raw = storage()?.getItem(VOCAB_KEY)
  if (!raw) return [...DEFAULT_CAPTION_VOCABULARY]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_CAPTION_VOCABULARY]
    const terms = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    return terms.length > 0 ? terms : [...DEFAULT_CAPTION_VOCABULARY]
  } catch {
    return [...DEFAULT_CAPTION_VOCABULARY]
  }
}

export function saveCaptionVocabulary(terms: readonly string[]): void {
  const clean = terms.map((term) => term.trim()).filter(Boolean)
  storage()?.setItem(VOCAB_KEY, JSON.stringify(clean))
}

export function loadDefaultCaptionStyleId(): string | null {
  const id = storage()?.getItem(DEFAULT_STYLE_KEY)?.trim()
  return id || null
}

export function saveDefaultCaptionStyleId(id: string | null): void {
  const box = storage()
  if (!box) return
  if (!id) box.removeItem(DEFAULT_STYLE_KEY)
  else box.setItem(DEFAULT_STYLE_KEY, id)
}
