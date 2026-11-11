import { insertKind, type CaptionWord, type CompositionInsert, type StyleRef } from "./composition.ts"

function tokenSpans(text: string): Array<{ start: number; end: number; text: string }> {
  const spans: Array<{ start: number; end: number; text: string }> = []
  const pattern = /\S+/g
  let match = pattern.exec(text)
  while (match) {
    spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] })
    match = pattern.exec(text)
  }
  return spans
}

function lineFromWords(
  source: CompositionInsert,
  words: CaptionWord[],
  sharedStyle: StyleRef | undefined,
): CompositionInsert | null {
  if (words.length === 0) return null
  const start = words[0]!.start
  const end = words[words.length - 1]!.end
  return {
    ...source,
    id: crypto.randomUUID(),
    text: words.map((word) => word.text).join(" "),
    start,
    duration: Math.max(0.05, end - start),
    words,
    styleRef: sharedStyle ?? source.styleRef,
    captionOwnStyle: undefined,
  }
}

function sharedLook(insert: CompositionInsert, sharedStyle: StyleRef | undefined): StyleRef | undefined {
  if (insert.captionOwnStyle) return sharedStyle
  return sharedStyle ?? insert.styleRef
}

/**
 * Divide no cursor. As duas linhas herdam o estilo global — sem override.
 */
export function splitCaptionAtCursor(
  insert: CompositionInsert,
  cursor: number,
  sharedStyle?: StyleRef,
): { left: CompositionInsert; right: CompositionInsert } | null {
  if (insertKind(insert) !== "caption") return null
  const text = insert.text ?? ""
  const spans = tokenSpans(text)
  const words = insert.words ?? []
  if (spans.length < 2 || words.length < 2) return null
  const aligned = spans.length === words.length
  const units = aligned ? spans.length : words.length
  let cut = 0
  if (aligned) {
    const inside = spans.findIndex((span) => cursor < span.end)
    if (inside <= 0) return null
    const span = spans[inside]!
    if (cursor <= span.start) cut = inside
    else if (cursor >= span.end) cut = inside + 1
    else {
      const word = words[inside]!
      const ratio = (cursor - span.start) / Math.max(1, span.text.length)
      const at = word.start + (word.end - word.start) * ratio
      const leftWords = words.slice(0, inside).map((item) => ({ ...item }))
      const rightWords = words.slice(inside + 1).map((item) => ({ ...item }))
      leftWords.push({ ...word, text: span.text.slice(0, cursor - span.start), end: at })
      rightWords.unshift({ ...word, text: span.text.slice(cursor - span.start), start: at })
      const left = lineFromWords(insert, leftWords, sharedLook(insert, sharedStyle))
      const right = lineFromWords(insert, rightWords, sharedLook(insert, sharedStyle))
      if (!left || !right) return null
      return { left, right }
    }
  } else {
    cut = Math.round((cursor / Math.max(1, text.length)) * units)
  }
  if (cut <= 0 || cut >= units) return null
  const left = lineFromWords(insert, words.slice(0, cut).map((word) => ({ ...word })), sharedLook(insert, sharedStyle))
  const right = lineFromWords(insert, words.slice(cut).map((word) => ({ ...word })), sharedLook(insert, sharedStyle))
  if (!left || !right) return null
  return { left, right }
}

export function joinCaptions(
  previous: CompositionInsert,
  current: CompositionInsert,
  sharedStyle?: StyleRef,
): CompositionInsert {
  const words = [...(previous.words ?? []), ...(current.words ?? [])].map((word) => ({ ...word }))
  const start = Math.min(previous.start, current.start)
  const end = Math.max(previous.start + previous.duration, current.start + current.duration)
  return {
    ...previous,
    text: [previous.text ?? "", current.text ?? ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
    start,
    duration: Math.max(0.05, end - start),
    words: words.length > 0 ? words : previous.words,
    styleRef: sharedStyle ?? (previous.captionOwnStyle ? undefined : previous.styleRef),
    captionOwnStyle: undefined,
  }
}

/** Divide antes ou depois da palavra mais próxima do playhead. */
export function splitCaptionAtTime(
  insert: CompositionInsert,
  time: number,
  sharedStyle?: StyleRef,
): { left: CompositionInsert; right: CompositionInsert } | null {
  const words = insert.words ?? []
  if (words.length < 2) return null
  let nearest = 0
  let best = Number.POSITIVE_INFINITY
  words.forEach((word, index) => {
    const mid = (word.start + word.end) / 2
    const dist = Math.abs(time - mid)
    if (dist < best) {
      best = dist
      nearest = index
    }
  })
  const word = words[nearest]!
  const mid = (word.start + word.end) / 2
  let cut = time <= mid ? nearest : nearest + 1
  if (cut <= 0) cut = 1
  if (cut >= words.length) cut = words.length - 1
  const left = lineFromWords(insert, words.slice(0, cut).map((item) => ({ ...item })), sharedLook(insert, sharedStyle))
  const right = lineFromWords(insert, words.slice(cut).map((item) => ({ ...item })), sharedLook(insert, sharedStyle))
  if (!left || !right) return null
  return { left, right }
}
