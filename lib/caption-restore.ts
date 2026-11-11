import { CAPTION_FRAME, separateCaptionWords } from "./caption-timing.ts"
import type { CaptionWord } from "./composition.ts"

function stem(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[\s"'“”«»()[\]-]+|[\s"'“”«»()[\].,:;!?…-]+$/g, "")
    .toLocaleLowerCase("pt-BR")
}

function displayToken(token: string): string {
  return token.replace(/^[\s"'“”«»()[\]-]+|[\s"'“”«»()[\].,:;!?…-]+$/g, "")
}

type DiffOp =
  | { kind: "match"; rawIndex: number; wordIndex: number }
  | { kind: "raw"; rawIndex: number }
  | { kind: "word"; wordIndex: number }

function diffTokens(raw: readonly string[], words: readonly string[]): DiffOp[] {
  const rows = raw.length
  const cols = words.length
  const scores: number[][] = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0))
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let col = cols - 1; col >= 0; col -= 1) {
      const rawStem = stem(raw[row] ?? "")
      const same = rawStem.length > 0 && rawStem === stem(words[col] ?? "")
      scores[row]![col] = same
        ? scores[row + 1]![col + 1]! + 1
        : Math.max(scores[row + 1]![col]!, scores[row]![col + 1]!)
    }
  }

  const ops: DiffOp[] = []
  let row = 0
  let col = 0
  while (row < rows && col < cols) {
    const rawStem = stem(raw[row] ?? "")
    if (rawStem.length > 0 && rawStem === stem(words[col] ?? "")) {
      ops.push({ kind: "match", rawIndex: row, wordIndex: col })
      row += 1
      col += 1
      continue
    }
    if (scores[row + 1]![col]! >= scores[row]![col + 1]!) {
      ops.push({ kind: "raw", rawIndex: row })
      row += 1
    } else {
      ops.push({ kind: "word", wordIndex: col })
      col += 1
    }
  }
  while (row < rows) ops.push({ kind: "raw", rawIndex: row++ })
  while (col < cols) ops.push({ kind: "word", wordIndex: col++ })
  return ops
}

type Slot =
  | { kind: "kept"; word: CaptionWord }
  | { kind: "missing"; text: string }

function spanWords(texts: readonly string[], start: number, end: number): CaptionWord[] {
  const slice = (end - start) / texts.length
  return texts.map((text, index) => ({
    text,
    start: start + index * slice,
    end: start + (index + 1) * slice,
  }))
}

/** Abre espaço para palavras que só existem no texto bruto. */
function placeMissing(texts: readonly string[], left: CaptionWord | null, right: CaptionWord | null): CaptionWord[] {
  const count = texts.length
  if (count === 0) return []
  const need = count * CAPTION_FRAME

  if (left && right) {
    const gap = right.start - left.end
    if (gap >= need - 1e-9) return spanWords(texts, left.end, right.start)
    const leftDur = left.end - left.start
    const rightDur = right.end - right.start
    if (leftDur >= rightDur) {
      const room = Math.max(0, leftDur - CAPTION_FRAME)
      const take = Math.min(room, Math.max(leftDur / 2, need - Math.max(0, gap)))
      const start = left.end - take
      left.end = start
      return spanWords(texts, start, right.start)
    }
    const room = Math.max(0, rightDur - CAPTION_FRAME)
    const take = Math.min(room, Math.max(rightDur / 2, need - Math.max(0, gap)))
    right.start += take
    return spanWords(texts, left.end, right.start)
  }

  if (left) {
    const room = Math.max(0, left.end - left.start - CAPTION_FRAME)
    const take = Math.min(room, Math.max((left.end - left.start) / 2, need))
    const start = left.end - take
    left.end = start
    return spanWords(texts, start, start + Math.max(take, need))
  }

  if (right) {
    const room = Math.max(0, right.end - right.start - CAPTION_FRAME)
    const take = Math.min(room, Math.max((right.end - right.start) / 2, need))
    const end = right.start + take
    right.start = end
    return spanWords(texts, end - Math.max(take, need), end)
  }

  return spanWords(texts, 0, need)
}

export function restoreCaptionWords(
  words: readonly CaptionWord[],
  rawText: string,
): { words: CaptionWord[]; inserted: number } {
  const rawTokens = rawText
    .trim()
    .split(/\s+/)
    .filter((token) => stem(token).length > 0)
  if (rawTokens.length === 0 || words.length === 0) {
    return { words: words.map((word) => ({ ...word })), inserted: 0 }
  }

  const slots: Slot[] = []
  let inserted = 0
  for (const op of diffTokens(rawTokens, words.map((word) => word.text))) {
    if (op.kind === "match") {
      const source = words[op.wordIndex]!
      const text = displayToken(rawTokens[op.rawIndex]!) || source.text
      slots.push({ kind: "kept", word: { ...source, text } })
      continue
    }
    if (op.kind === "word") {
      slots.push({ kind: "kept", word: { ...words[op.wordIndex]! } })
      continue
    }
    const text = displayToken(rawTokens[op.rawIndex]!)
    if (!text) continue
    slots.push({ kind: "missing", text })
    inserted += 1
  }

  const placed: CaptionWord[] = []
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!
    if (slot.kind === "kept") {
      placed.push(slot.word)
      continue
    }
    let end = index
    while (end < slots.length && slots[end]?.kind === "missing") end += 1
    const texts = slots.slice(index, end).flatMap((item) => (item.kind === "missing" ? [item.text] : []))
    const left = placed[placed.length - 1] ?? null
    const right = slots[end]?.kind === "kept" ? slots[end].word : null
    placed.push(...placeMissing(texts, left, right))
    index = end - 1
  }

  return { words: separateCaptionWords(placed), inserted }
}
