import {
  CAPTION_INSERT_TYPE,
  clampInsert,
  insertKind,
  mergeInsertPatch,
  type CaptionWord,
  type CompositionInsert,
} from "./composition.ts"
import { createInsert } from "./inserts.ts"
import { toAbsoluteCaptionWords } from "./caption-time.ts"

export type { CaptionWord }

export interface CaptionLine {
  start: number
  duration: number
  text: string
  words: CaptionWord[]
}

export type GroupOptions = {
  maxWords: number
  maxDuration: number
  gapBreak: number
  breakOnPunctuation: boolean
}

export const DEFAULT_GROUP_OPTIONS: GroupOptions = {
  maxWords: 4,
  maxDuration: 2,
  gapBreak: 0.4,
  breakOnPunctuation: true,
}

export const WHISPER_CAPTION_REQUEST = {
  responseFormat: "verbose_json",
  timestampGranularity: "word",
} as const

const MIN_DURATION = 0.5
const MIN_WORD_DURATION = 0.05
const SENTENCE_END = /[.?!]$/

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function parseMaxWords(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_GROUP_OPTIONS.maxWords
  const parsed =
    typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."))
  if (!Number.isFinite(parsed)) return DEFAULT_GROUP_OPTIONS.maxWords
  return Math.round(clamp(parsed, 1, 6))
}

export function resolveGroupOptions(partial?: Partial<GroupOptions>): GroupOptions {
  const maxDuration =
    typeof partial?.maxDuration === "number" && Number.isFinite(partial.maxDuration)
      ? Math.max(0.2, partial.maxDuration)
      : DEFAULT_GROUP_OPTIONS.maxDuration
  const gapBreak =
    typeof partial?.gapBreak === "number" && Number.isFinite(partial.gapBreak)
      ? Math.max(0, partial.gapBreak)
      : DEFAULT_GROUP_OPTIONS.gapBreak
  return {
    maxWords: parseMaxWords(partial?.maxWords ?? DEFAULT_GROUP_OPTIONS.maxWords),
    maxDuration,
    gapBreak,
    breakOnPunctuation: partial?.breakOnPunctuation ?? DEFAULT_GROUP_OPTIONS.breakOnPunctuation,
  }
}

function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text)
}

function lineText(words: CaptionWord[]): string {
  return words.map((word) => word.text).join(" ")
}

function usableCaptionWords(words: CaptionWord[] | undefined): CaptionWord[] {
  if (!Array.isArray(words)) return []
  return words.filter(
    (word) =>
      Boolean(word.text?.trim()) &&
      Number.isFinite(word.start) &&
      Number.isFinite(word.end) &&
      word.end > word.start,
  )
}

export function wordsForCaptionLine(line: CaptionLine): CaptionWord[] {
  const existing = usableCaptionWords(line.words)
  if (existing.length > 0) return existing
  const relative = reflowCaptionWords(line.text ?? "", line.duration)
  return relative.map((word) => ({
    text: word.text,
    start: word.start + line.start,
    end: word.end + line.start,
  }))
}

function nativeDuration(words: CaptionWord[]): number {
  if (words.length === 0) return 0
  const first = words[0]!
  const last = words[words.length - 1]!
  return last.end - first.start
}

function buildLine(words: CaptionWord[]): CaptionLine {
  const lineStart = words[0]!.start
  return {
    start: lineStart,
    duration: Math.max(nativeDuration(words), MIN_DURATION),
    text: lineText(words),
    words: words.map((word) => ({ ...word })),
  }
}

function shouldBreakCard(
  current: CaptionWord[],
  nextWord: CaptionWord,
  previousWord: CaptionWord,
  options: GroupOptions,
): boolean {
  if (current.length >= options.maxWords) return true
  const span = nextWord.end - current[0]!.start
  if (span > options.maxDuration) return true
  if (nextWord.start - previousWord.end > options.gapBreak) return true
  if (options.breakOnPunctuation && endsSentence(previousWord.text)) return true
  return false
}

export function groupCaptionLines(
  inputWords: CaptionWord[],
  options?: Partial<GroupOptions>,
): CaptionLine[] {
  if (inputWords.length === 0) return []
  const resolved = resolveGroupOptions(options)
  const lines: CaptionLine[] = []
  let current: CaptionWord[] = [inputWords[0]!]

  for (let index = 1; index < inputWords.length; index += 1) {
    const nextWord = inputWords[index]!
    const previousWord = current[current.length - 1]!
    if (shouldBreakCard(current, nextWord, previousWord, resolved)) {
      lines.push(buildLine(current))
      current = [nextWord]
    } else {
      current.push(nextWord)
    }
  }

  lines.push(buildLine(current))
  return lines
}

export function activeCaptionWord(words: CaptionWord[], time: number): CaptionWord | null {
  if (words.length === 0) return null
  if (time < words[0]!.start) return null

  let previous: CaptionWord | null = null

  for (const word of words) {
    if (time >= word.start && time < word.end) return word
    if (time >= word.end) previous = word
  }

  return previous
}

export function reflowCaptionWords(text: string, duration: number): CaptionWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const weights = tokens.map((token) => token.length)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const words: CaptionWord[] = []
  let cursor = 0

  for (let index = 0; index < tokens.length; index += 1) {
    const isLast = index === tokens.length - 1

    if (isLast) {
      const start = Math.min(cursor, duration)
      const end = duration
      words.push({
        text: tokens[index]!,
        start: start > end ? end : start,
        end,
      })
      break
    }

    const remaining = tokens.length - index - 1
    const reservedForRemaining = remaining * MIN_WORD_DURATION
    const maxEnd = duration - reservedForRemaining
    const proportionalEnd = cursor + (duration * weights[index]!) / totalWeight
    const minEnd = cursor + MIN_WORD_DURATION
    const end = Math.max(cursor, Math.min(duration, Math.max(proportionalEnd, minEnd), maxEnd))

    words.push({
      text: tokens[index]!,
      start: cursor,
      end,
    })
    cursor = end
  }

  return words
}

function reflowTokens(tokens: string[], rangeStart: number, rangeEnd: number): CaptionWord[] {
  if (tokens.length === 0) return []
  let start = rangeStart
  let end = rangeEnd
  if (!(end > start)) {
    end = start + tokens.length * MIN_WORD_DURATION
  }
  const relative = reflowCaptionWords(tokens.join(" "), end - start)
  return relative.map((word) => ({
    text: word.text,
    start: word.start + start,
    end: word.end + start,
  }))
}

function sameToken(left: string, right: string): boolean {
  return left === right || left.toLocaleLowerCase("pt-BR") === right.toLocaleLowerCase("pt-BR")
}

export function preserveCaptionWordTimings(
  previous: CaptionWord[],
  text: string,
  windowStart: number,
  windowEnd: number,
): CaptionWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const assigned: Array<CaptionWord | null> = tokens.map(() => null)
  let prevIndex = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    let found = -1
    for (let cursor = prevIndex; cursor < previous.length; cursor += 1) {
      if (sameToken(previous[cursor]!.text, token)) {
        found = cursor
        break
      }
    }
    if (found >= 0) {
      assigned[index] = {
        text: token,
        start: previous[found]!.start,
        end: previous[found]!.end,
      }
      prevIndex = found + 1
    }
  }

  let index = 0
  while (index < tokens.length) {
    if (assigned[index]) {
      index += 1
      continue
    }
    let nextKnown = index
    while (nextKnown < tokens.length && !assigned[nextKnown]) nextKnown += 1
    const gapTokens = tokens.slice(index, nextKnown)
    const rangeStart = index === 0 ? windowStart : assigned[index - 1]!.end
    const rangeEnd =
      nextKnown >= tokens.length || !assigned[nextKnown] ? windowEnd : assigned[nextKnown]!.start
    const filled = reflowTokens(gapTokens, rangeStart, rangeEnd)
    for (let offset = 0; offset < filled.length; offset += 1) {
      assigned[index + offset] = filled[offset]!
    }
    index = nextKnown
  }

  return assigned.map(
    (word, wordIndex) =>
      word ?? { text: tokens[wordIndex]!, start: windowStart, end: windowEnd },
  )
}

export function retargetCaptionWords(
  prev: { start: number; duration: number; words: CaptionWord[] },
  next: { start: number; duration: number; words: CaptionWord[] },
): { start: number; duration: number; words: CaptionWord[] } {
  const absolute = toAbsoluteCaptionWords(prev.words, prev.start, prev.duration)
  const windowStart = next.start
  const windowEnd = next.start + next.duration
  const retargeted: CaptionWord[] = []

  for (const word of absolute) {
    if (word.start >= windowEnd) continue
    if (word.end <= windowStart) continue
    retargeted.push({
      text: word.text,
      start: Math.max(word.start, windowStart),
      end: Math.min(word.end, windowEnd),
    })
  }

  return {
    start: next.start,
    duration: next.duration,
    words: retargeted,
  }
}

export const CAPTION_WARNINGS = ["words-estimated"] as const
export type CaptionWarning = (typeof CAPTION_WARNINGS)[number]

export interface WhisperCaptionPayload {
  words?: Array<{ word?: string; text?: string; start?: number; end?: number }>
  segments?: Array<{ start?: number; end?: number; text?: string }>
}

export function parseWhisperCaptionResult(payload: WhisperCaptionPayload): {
  words: CaptionWord[]
  estimated: boolean
} {
  const rawWords = Array.isArray(payload.words) ? payload.words : []
  const fromWords: CaptionWord[] = []
  for (const item of rawWords) {
    const text = String(item.word ?? item.text ?? "").trim()
    const start = Number(item.start)
    const end = Number(item.end)
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    fromWords.push({ text, start, end })
  }
  if (fromWords.length) return { words: fromWords, estimated: false }

  const estimated: CaptionWord[] = []
  for (const segment of payload.segments ?? []) {
    const text = String(segment.text ?? "").trim()
    const start = Number(segment.start)
    const end = Number(segment.end)
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const tokens = text.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const span = (end - start) / tokens.length
    tokens.forEach((token, index) => {
      const wordStart = start + index * span
      estimated.push({
        text: token,
        start: wordStart,
        end: index === tokens.length - 1 ? end : wordStart + span,
      })
    })
  }
  return { words: estimated, estimated: estimated.length > 0 }
}

export async function runCaptionsPipeline(
  input: { duration: number; mediaBytes: number; maxWords?: number },
  deps: { transcribe: () => Promise<WhisperCaptionPayload> },
): Promise<{ lines: CaptionLine[]; warnings: CaptionWarning[] }> {
  const payload = await deps.transcribe()
  const parsed = parseWhisperCaptionResult(payload)
  if (parsed.words.length === 0) throw new Error("captions-empty")
  const lines = groupCaptionLines(parsed.words, { maxWords: parseMaxWords(input.maxWords) })
  if (lines.length === 0) throw new Error("captions-empty")
  return {
    lines,
    warnings: parsed.estimated ? ["words-estimated"] : [],
  }
}

export function finalizeCaptionInsert(
  created: CompositionInsert,
  videoDuration: number,
): CompositionInsert {
  const preClamp = {
    start: created.start,
    duration: created.duration,
    words: created.words ?? [],
  }
  const clamped = clampInsert(
    created,
    videoDuration > 0 ? videoDuration : created.start + created.duration,
  )
  if (clamped.start === preClamp.start && clamped.duration === preClamp.duration) {
    return clamped
  }
  return {
    ...clamped,
    words: retargetCaptionWords(preClamp, {
      start: clamped.start,
      duration: clamped.duration,
      words: clamped.words ?? [],
    }).words,
  }
}

/**
 * Corta só o que passa do fim da timeline. Uma linha que começa depois do fim
 * sai inteira; não é puxada para trás (isso empilhava as legendas no fim da fonte).
 */
export function fitCaptionLinesToOutput(
  lines: readonly CaptionLine[],
  outputDuration: number,
): { lines: CaptionLine[]; dropped: number } {
  if (!(outputDuration > 0)) {
    return { lines: lines.map((line) => ({ ...line, words: line.words.map((word) => ({ ...word })) })), dropped: 0 }
  }
  const min = 0.05
  const kept: CaptionLine[] = []
  let dropped = 0
  for (const line of lines) {
    if (!(line.start < outputDuration - min)) {
      dropped += 1
      continue
    }
    const duration = Math.min(line.duration, outputDuration - line.start)
    if (!(duration >= min)) {
      dropped += 1
      continue
    }
    const end = line.start + duration
    const words = line.words
      .filter((word) => word.start < end - 0.01)
      .map((word) => (word.end > end ? { ...word, end } : { ...word }))
    kept.push({ ...line, duration, words })
  }
  return { lines: kept, dropped }
}

export function linesToCaptionInserts(lines: CaptionLine[], videoDuration: number): CompositionInsert[] {
  return lines.map((line) => {
    const created = createInsert(CAPTION_INSERT_TYPE)
    created.text = line.text
    created.start = line.start
    created.duration = line.duration
    created.words = wordsForCaptionLine(line)
    created.animIn = "none"
    created.animOut = "none"
    return finalizeCaptionInsert(created, videoDuration)
  })
}

export function replaceCaptionInserts(
  current: CompositionInsert[],
  incoming: CompositionInsert[],
): CompositionInsert[] {
  return [...current.filter((insert) => insertKind(insert) !== "caption"), ...incoming]
}

export function applyCaptionPatch(
  insert: CompositionInsert,
  patch: Partial<CompositionInsert>,
): CompositionInsert {
  const next = mergeInsertPatch(insert, patch)
  if (insertKind(next) !== "caption") return next
  if (typeof patch.text === "string" && patch.text !== insert.text) {
    const previous = toAbsoluteCaptionWords(
      insert.words ?? [],
      insert.start,
      insert.duration,
    )
    return {
      ...next,
      words: preserveCaptionWordTimings(
        previous,
        next.text ?? "",
        next.start,
        next.start + next.duration,
      ),
    }
  }
  if (patch.start !== undefined || patch.duration !== undefined) {
    const retargeted = retargetCaptionWords(
      { start: insert.start, duration: insert.duration, words: insert.words ?? [] },
      { start: next.start, duration: next.duration, words: next.words ?? insert.words ?? [] },
    )
    return { ...next, words: retargeted.words }
  }
  return next
}
