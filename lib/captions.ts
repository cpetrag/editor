import { breakCaptionWords } from "./caption-break.ts"
import { tidyCaptionSpeech } from "./caption-speech.ts"
import { alignPunctuatedTokens } from "./caption-punctuate.ts"
import { restoreCaptionWords } from "./caption-restore.ts"
import { toAbsoluteCaptionWords } from "./caption-time.ts"
import {
  CAPTION_INSERT_TYPE,
  clampInsert,
  insertKind,
  mergeInsertPatch,
  type CaptionWord,
  type CompositionInsert,
} from "./composition.ts"
import { createInsert } from "./inserts.ts"

export type { CaptionWord }

export interface CaptionLine {
  start: number
  duration: number
  text: string
  words: CaptionWord[]
}

export type GroupOptions = {
  maxWords: number
  maxChars: number
  maxDuration: number
  gapBreak: number
  breakOnPunctuation: boolean
}

export const DEFAULT_GROUP_OPTIONS: GroupOptions = {
  maxWords: 4,
  maxChars: 22,
  maxDuration: 2,
  gapBreak: 0.25,
  breakOnPunctuation: true,
}

export const WHISPER_CAPTION_REQUEST = {
  responseFormat: "verbose_json",
  timestampGranularity: "word",
} as const

const MIN_DURATION = 0.5
const MIN_WORD_DURATION = 0.05

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

export function parseMaxChars(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_GROUP_OPTIONS.maxChars
  const parsed =
    typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."))
  if (!Number.isFinite(parsed)) return DEFAULT_GROUP_OPTIONS.maxChars
  return Math.round(clamp(parsed, 8, 48))
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
    maxChars: parseMaxChars(partial?.maxChars ?? DEFAULT_GROUP_OPTIONS.maxChars),
    maxDuration,
    gapBreak,
    breakOnPunctuation: partial?.breakOnPunctuation ?? DEFAULT_GROUP_OPTIONS.breakOnPunctuation,
  }
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

export function groupCaptionLines(
  inputWords: CaptionWord[],
  options?: Partial<GroupOptions>,
  emphasis?: (text: string) => boolean,
  phrases?: readonly string[],
): CaptionLine[] {
  if (inputWords.length === 0) return []
  const resolved = resolveGroupOptions(options)
  return breakCaptionWords(inputWords, resolved, emphasis, phrases).map(buildLine)
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

type AlignOp =
  | { kind: "keep" | "sub"; prev: CaptionWord; text: string }
  | { kind: "del"; prev: CaptionWord }
  | { kind: "ins"; text: string }

function alignTokenOps(previous: CaptionWord[], tokens: string[]): AlignOp[] {
  const rowCount = previous.length + 1
  const colCount = tokens.length + 1
  const cost: number[][] = Array.from({ length: rowCount }, () => new Array<number>(colCount).fill(0))
  const back: number[][] = Array.from({ length: rowCount }, () => new Array<number>(colCount).fill(0))
  for (let row = 1; row < rowCount; row += 1) {
    cost[row]![0] = row
    back[row]![0] = 1
  }
  for (let col = 1; col < colCount; col += 1) {
    cost[0]![col] = col
    back[0]![col] = 2
  }
  for (let row = 1; row < rowCount; row += 1) {
    for (let col = 1; col < colCount; col += 1) {
      const same = sameToken(previous[row - 1]!.text, tokens[col - 1]!)
      const substitute = cost[row - 1]![col - 1]! + (same ? 0 : 1)
      const deleted = cost[row - 1]![col]! + 1
      const inserted = cost[row]![col - 1]! + 1
      if (substitute <= deleted && substitute <= inserted) {
        cost[row]![col] = substitute
        back[row]![col] = 3
      } else if (deleted <= inserted) {
        cost[row]![col] = deleted
        back[row]![col] = 1
      } else {
        cost[row]![col] = inserted
        back[row]![col] = 2
      }
    }
  }
  const ops: AlignOp[] = []
  let row = previous.length
  let col = tokens.length
  while (row > 0 || col > 0) {
    const step = row === 0 ? 2 : col === 0 ? 1 : back[row]![col]!
    if (step === 3) {
      const prev = previous[row - 1]!
      const text = tokens[col - 1]!
      ops.push({ kind: sameToken(prev.text, text) ? "keep" : "sub", prev, text })
      row -= 1
      col -= 1
    } else if (step === 1) {
      ops.push({ kind: "del", prev: previous[row - 1]! })
      row -= 1
    } else {
      ops.push({ kind: "ins", text: tokens[col - 1]! })
      col -= 1
    }
  }
  ops.reverse()
  return ops
}

/**
 * Palavra mantida conserva o tempo. Palavra trocada herda o tempo da original.
 * Palavra inserida divide o tempo livre da vizinha. Palavra removida entrega o tempo à vizinha.
 */
export function preserveCaptionWordTimings(
  previous: CaptionWord[],
  text: string,
  windowStart: number,
  windowEnd: number,
): CaptionWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  if (previous.length === 0) return reflowTokens(tokens, windowStart, windowEnd)

  type Slot = { text: string; start: number; end: number; fixed: boolean }
  const slots: Slot[] = []
  const deleted: CaptionWord[] = []
  for (const op of alignTokenOps(previous, tokens)) {
    if (op.kind === "del") {
      deleted.push(op.prev)
      continue
    }
    if (op.kind === "ins") {
      slots.push({ text: op.text, start: Number.NaN, end: Number.NaN, fixed: false })
      continue
    }
    let start = op.prev.start
    let end = op.prev.end
    if (deleted.length > 0 && deleted[0]!.end <= start + 1e-6) {
      start = deleted[0]!.start
      deleted.length = 0
    }
    slots.push({ text: op.text, start, end, fixed: true })
  }
  if (deleted.length > 0 && slots.length > 0) {
    const last = slots[slots.length - 1]!
    if (last.fixed) last.end = Math.max(last.end, deleted[deleted.length - 1]!.end)
  }

  let index = 0
  while (index < slots.length) {
    if (slots[index]!.fixed) {
      index += 1
      continue
    }
    let nextFixed = index
    while (nextFixed < slots.length && !slots[nextFixed]!.fixed) nextFixed += 1
    const inserted = slots.slice(index, nextFixed)
    const prev = index > 0 ? slots[index - 1]! : null
    const next = nextFixed < slots.length ? slots[nextFixed]! : null
    const slackStart = prev?.fixed ? prev.end : windowStart
    const slackEnd = next?.fixed ? next.start : windowEnd
    if (slackEnd - slackStart >= inserted.length * MIN_WORD_DURATION) {
      const slice = (slackEnd - slackStart) / inserted.length
      inserted.forEach((slot, offset) => {
        slot.start = slackStart + offset * slice
        slot.end = slackStart + (offset + 1) * slice
        slot.fixed = true
      })
    } else if (next?.fixed && next.end > next.start) {
      const pieces = inserted.length + 1
      const slice = (next.end - next.start) / pieces
      let cursor = next.start
      for (const slot of inserted) {
        slot.start = cursor
        slot.end = cursor + slice
        slot.fixed = true
        cursor += slice
      }
      next.start = cursor
    } else if (prev?.fixed && prev.end > prev.start) {
      const pieces = inserted.length + 1
      const slice = (prev.end - prev.start) / pieces
      prev.end = prev.start + slice
      let cursor = prev.end
      for (const slot of inserted) {
        slot.start = cursor
        slot.end = cursor + slice
        slot.fixed = true
        cursor += slice
      }
    } else {
      const filled = reflowTokens(inserted.map((slot) => slot.text), windowStart, windowEnd)
      inserted.forEach((slot, offset) => {
        slot.start = filled[offset]?.start ?? windowStart
        slot.end = filled[offset]?.end ?? windowEnd
        slot.fixed = true
      })
    }
    index = nextFixed
  }

  return slots.map((slot) => ({
    text: slot.text,
    start: Number.isFinite(slot.start) ? slot.start : windowStart,
    end: Number.isFinite(slot.end) && slot.end > slot.start ? slot.end : windowEnd,
  }))
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

export const CAPTION_WARNINGS = ["words-estimated", "punctuated"] as const
export type CaptionWarning = (typeof CAPTION_WARNINGS)[number] | `words-restored:${number}`

export interface WhisperCaptionPayload {
  text?: string
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
  input: { duration: number; mediaBytes: number; maxWords?: number; vocabulary?: readonly string[] },
  deps: {
    transcribe: () => Promise<WhisperCaptionPayload>
    punctuate?: (words: readonly string[]) => Promise<string[] | null>
  },
): Promise<{ lines: CaptionLine[]; warnings: CaptionWarning[] }> {
  const payload = await deps.transcribe()
  const parsed = parseWhisperCaptionResult(payload)
  const restored = restoreCaptionWords(parsed.words, payload.text ?? "")
  let spoken = restored.words
  if (spoken.length === 0) throw new Error("captions-empty")
  const warnings: CaptionWarning[] = parsed.estimated ? ["words-estimated"] : []
  if (restored.inserted > 0) warnings.push(`words-restored:${restored.inserted}`)
  const joined = spoken.map((word) => word.text).join(" ")
  if (deps.punctuate && !/[,.!?]/.test(joined)) {
    const raw = await deps.punctuate(spoken.map((word) => word.text))
    const punctuated = raw ? alignPunctuatedTokens(spoken.map((word) => word.text), raw) : null
    if (punctuated && punctuated.length === spoken.length) {
      spoken = spoken.map((word, index) => ({ ...word, text: punctuated[index] ?? word.text }))
      warnings.push("punctuated")
    }
  }
  spoken = tidyCaptionSpeech(spoken)
  const lines = groupCaptionLines(spoken, { maxWords: parseMaxWords(input.maxWords) })
  if (lines.length === 0) throw new Error("captions-empty")
  return { lines, warnings }
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
