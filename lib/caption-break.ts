import type { CaptionWord } from "./composition.ts"

type BreakOptions = {
  maxWords: number
  maxChars: number
  maxDuration: number
  gapBreak: number
  breakOnPunctuation: boolean
}

/** Palavras que não devem fechar um card. */
export const WEAK_CAPTION_WORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "por",
  "pra",
  "para",
  "com",
  "que",
  "e",
  "ou",
  "se",
  "mas",
  "meu",
  "minha",
  "seu",
  "sua",
])

const SENTENCE_END = /[.!?]$/
const SOFT_PUNCT = /[,:]$/

function bareWord(text: string): string {
  return text.replace(/^[\s"'“”«»()[\]-]+|[\s"'“”«»()[\].,:;!?-]+$/g, "").toLocaleLowerCase("pt-BR")
}

function isWeakEnding(text: string): boolean {
  return WEAK_CAPTION_WORDS.has(bareWord(text))
}

/**
 * Custo de um card words[start..end). Menor é melhor.
 * Ponto final força quebra; vírgula só ajuda se não criar uma palavra solta.
 * Uma palavra a mais que o alvo pesa menos do que terminar em "a", "por", "e".
 */
function segmentCost(
  words: readonly CaptionWord[],
  start: number,
  end: number,
  options: BreakOptions,
  emphasis: (text: string) => boolean,
  phrases: ReadonlyArray<readonly [number, number]>,
): number {
  const count = end - start
  if (phrases.some(([from, to]) => end > from && end < to)) return Number.POSITIVE_INFINITY
  const first = words[start]!
  const last = words[end - 1]!
  let chars = 0
  for (let index = start; index < end; index += 1) {
    chars += words[index]!.text.length
    if (index > start) chars += 1
  }
  const singleWord = count === 1
  if (chars > options.maxChars && !singleWord) return Number.POSITIVE_INFINITY
  const wordCeiling = options.maxWords <= 1 ? options.maxWords : options.maxWords + 1
  if (count > wordCeiling) return Number.POSITIVE_INFINITY
  let cost = 1
  if (isWeakEnding(last.text) && options.maxWords > 1) cost += 36
  if (count > 1 && isWeakEnding(words[start]!.text) && options.maxWords > 1) cost += 12
  if (count > options.maxWords) cost += (count - options.maxWords) * 28
  if (chars > options.maxChars) cost += (chars - options.maxChars) * 8
  if (count === 1 && options.maxWords > 1 && !emphasis(last.text) && !emphasis(bareWord(last.text))) {
    cost += 16
  }
  if (count < options.maxWords) cost += (options.maxWords - count) * 0.35
  const span = last.end - first.start
  if (span > options.maxDuration) cost += 40
  if (count > 1 && first.end - first.start > options.maxDuration) cost += 50
  if (end < words.length) {
    const next = words[end]!
    if (options.breakOnPunctuation && SENTENCE_END.test(last.text.trim())) cost -= 50
    else if (options.breakOnPunctuation && SOFT_PUNCT.test(last.text.trim())) cost -= 8
    if (next.start - last.end >= options.gapBreak) cost -= 40
  }
  return cost
}

export function phraseSpans(
  words: readonly { text: string }[],
  phrases: readonly string[],
): Array<[number, number]> {
  const keys = words.map((word) => bareWord(word.text))
  const spans: Array<[number, number]> = []
  for (const phrase of phrases) {
    const parts = phrase.trim().split(/\s+/).filter(Boolean).map((part) => bareWord(part))
    if (parts.length < 2) continue
    for (let index = 0; index <= keys.length - parts.length; index += 1) {
      if (parts.every((part, offset) => keys[index + offset] === part)) {
        spans.push([index, index + parts.length])
      }
    }
  }
  return spans
}

/**
 * Quebras por programação dinâmica. Devolve grupos de palavras, sem alterar tempos.
 * maxChars é teto duro (uma palavra sozinha pode passar). maxWords é alvo, no máximo +1.
 */
export function breakCaptionWords(
  words: readonly CaptionWord[],
  options?: Partial<BreakOptions>,
  emphasis: (text: string) => boolean = () => false,
  phrases: readonly string[] = [],
): CaptionWord[][] {
  if (words.length === 0) return []
  const resolved: BreakOptions = {
    maxWords: options?.maxWords ?? 4,
    maxDuration: options?.maxDuration ?? 2,
    gapBreak: options?.gapBreak ?? 0.25,
    breakOnPunctuation: options?.breakOnPunctuation ?? true,
    maxChars: options?.maxChars ?? 22,
  }
  const spans = phraseSpans(words, phrases)
  const count = words.length
  const best = new Array<number>(count + 1).fill(Number.POSITIVE_INFINITY)
  const from = new Array<number>(count + 1).fill(0)
  best[0] = 0
  for (let end = 1; end <= count; end += 1) {
    for (let start = 0; start < end; start += 1) {
      const piece = segmentCost(words, start, end, resolved, emphasis, spans)
      if (!Number.isFinite(piece) || !Number.isFinite(best[start]!)) continue
      const cost = best[start]! + piece
      const better = cost < best[end]! - 1e-9
      const tieLonger = Math.abs(cost - best[end]!) <= 1e-9 && start > from[end]!
      if (better || tieLonger) {
        best[end] = cost
        from[end] = start
      }
    }
  }
  const groups: CaptionWord[][] = []
  let cursor = count
  while (cursor > 0) {
    const start = from[cursor]!
    groups.push(words.slice(start, cursor).map((word) => ({ ...word })))
    if (start === cursor) break
    cursor = start
  }
  groups.reverse()
  return groups
}
