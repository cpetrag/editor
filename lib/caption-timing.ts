import type { CaptionLine } from "./captions.ts"
import type { CaptionWord } from "./composition.ts"
import { stackLanes } from "./insert-ops.ts"

export const CAPTION_FPS = 30
export const CAPTION_FRAME = 1 / CAPTION_FPS
/** Buraco menor que isso é fechado para a legenda não piscar. */
export const CAPTION_GAP_FILL = 0.25
/** Duração mínima, desde que não invada a linha seguinte. */
export const CAPTION_MIN_LINE = 0.4

export function snapCaptionTime(time: number): number {
  if (!Number.isFinite(time)) return 0
  return Math.round(time * CAPTION_FPS) / CAPTION_FPS
}

function cloneLine(line: CaptionLine): CaptionLine {
  return {
    start: line.start,
    duration: line.duration,
    text: line.text,
    words: (line.words ?? []).map((word) => ({ ...word })),
  }
}

function snapWord(word: CaptionWord): CaptionWord {
  const start = snapCaptionTime(word.start)
  let end = snapCaptionTime(word.end)
  if (!(end > start)) end = snapCaptionTime(start + CAPTION_FRAME)
  return { ...word, start, end }
}

/** Depois do snap, nenhuma palavra invade a seguinte e cada uma dura pelo menos 1 frame. */
export function separateCaptionWords(words: readonly CaptionWord[]): CaptionWord[] {
  const next = words.map((word) => snapWord(word))
  for (let index = 0; index < next.length - 1; index += 1) {
    const current = next[index]!
    const following = next[index + 1]!
    if (current.end > following.start) current.end = following.start
    if (current.end - current.start < CAPTION_FRAME - 1e-9) {
      const minEnd = snapCaptionTime(current.start + CAPTION_FRAME)
      if (minEnd <= following.start + 1e-9) current.end = minEnd
      else {
        current.end = snapCaptionTime(current.start + CAPTION_FRAME)
        following.start = current.end
        if (following.end < following.start + CAPTION_FRAME - 1e-9) {
          following.end = snapCaptionTime(following.start + CAPTION_FRAME)
        }
      }
    }
  }
  const last = next[next.length - 1]
  if (last && last.end - last.start < CAPTION_FRAME - 1e-9) {
    last.end = snapCaptionTime(last.start + CAPTION_FRAME)
  }
  return next
}

function lineEnd(line: CaptionLine): number {
  return line.start + line.duration
}

function commitEnd(line: CaptionLine, end: number): void {
  const clipped = Math.max(line.start, end)
  line.duration = clipped - line.start
  const words: CaptionWord[] = []
  for (const word of line.words) {
    if (word.start >= clipped - 1e-6) continue
    const wordEnd = Math.min(word.end, clipped)
    if (!(wordEnd > word.start)) continue
    words.push({ ...word, end: wordEnd })
  }
  line.words = words
  line.text = words.map((word) => word.text).join(" ")
}

function mergePair(left: CaptionLine, right: CaptionLine): CaptionLine {
  const words = [...left.words, ...right.words].map((word) => ({ ...word }))
  const start = Math.min(left.start, right.start)
  const end = Math.max(lineEnd(left), lineEnd(right))
  return {
    start,
    duration: Math.max(CAPTION_FRAME, end - start),
    text: words.map((word) => word.text).join(" "),
    words,
  }
}

/**
 * Encaixa linhas e palavras em frames de 30 fps, elimina sobreposição,
 * fecha buracos curtos e garante 0,4 s sem invadir a próxima.
 */
export function normalizeCaptionLines(input: readonly CaptionLine[]): CaptionLine[] {
  let lines = input
    .filter((line) => (line.words?.length ?? 0) > 0 || line.text.trim())
    .map(cloneLine)
    .map((line) => {
      const words = separateCaptionWords(line.words.length > 0 ? line.words : [])
      const start = words.length > 0 ? words[0]!.start : snapCaptionTime(line.start)
      const rawEnd = snapCaptionTime(line.start + line.duration)
      const wordEnd = words.length > 0 ? words[words.length - 1]!.end : rawEnd
      const end = Math.max(rawEnd, wordEnd, start + CAPTION_FRAME)
      return {
        start,
        duration: end - start,
        text: words.length > 0 ? words.map((word) => word.text).join(" ") : line.text,
        words,
      }
    })
    .sort((a, b) => a.start - b.start || a.text.localeCompare(b.text))

  for (let pass = 0; pass < 24 && lines.length > 1; pass += 1) {
    let changed = false
    for (let index = 0; index < lines.length - 1; index += 1) {
      const current = lines[index]!
      const next = lines[index + 1]!
      if (lineEnd(current) > next.start + 1e-6) {
        commitEnd(current, next.start)
        changed = true
      }
    }
    for (let index = 0; index < lines.length - 1; index += 1) {
      const current = lines[index]!
      const next = lines[index + 1]!
      const gap = next.start - lineEnd(current)
      if (gap > 1e-6 && gap < CAPTION_GAP_FILL) {
        commitEnd(current, next.start)
        changed = true
      }
    }
    const merged: CaptionLine[] = []
    for (let index = 0; index < lines.length; index += 1) {
      const current = lines[index]!
      if (current.words.length === 0) {
        changed = true
        continue
      }
      const next = lines[index + 1]
      if (current.duration + 1e-6 < CAPTION_MIN_LINE && next) {
        const room = next.start - current.start
        if (room + 1e-6 >= CAPTION_MIN_LINE && lineEnd(current) + 1e-6 < current.start + CAPTION_MIN_LINE) {
          commitEnd(current, Math.min(next.start, current.start + CAPTION_MIN_LINE))
          changed = true
          merged.push(current)
          continue
        }
        if (room + 1e-6 < CAPTION_MIN_LINE) {
          merged.push(mergePair(current, next))
          index += 1
          changed = true
          continue
        }
      }
      if (!next && current.duration + 1e-6 < CAPTION_MIN_LINE) {
        commitEnd(current, current.start + CAPTION_MIN_LINE)
        changed = true
      }
      merged.push(current)
    }
    lines = merged
    if (!changed) break
  }
  return lines
}

export function captionsShareOneLane(
  lines: readonly { id?: string; start: number; duration: number }[],
): boolean {
  if (lines.length <= 1) return true
  const lanes = stackLanes(
    lines.map((line, index) => ({
      id: line.id ?? `l${index}`,
      start: line.start,
      duration: line.duration,
    })),
  )
  const used = new Set(lanes.values())
  return used.size <= 1
}

export function limitCaptionEdge(
  captions: readonly { id: string; start: number; duration: number }[],
  id: string,
  edge: "in" | "out",
  next: { start: number; duration: number },
): { start: number; duration: number } {
  const current = captions.find((item) => item.id === id)
  if (!current) return next
  const others = captions
    .filter((item) => item.id !== id)
    .slice()
    .sort((a, b) => a.start - b.start)
  if (edge === "out") {
    const end = next.start + next.duration
    const blocker = others.find((item) => item.start >= current.start + current.duration - 1e-4)
    if (!blocker) return next
    const capped = Math.min(end, blocker.start)
    const duration = Math.max(CAPTION_FRAME, capped - next.start)
    return { start: next.start, duration }
  }
  const blocker = [...others].reverse().find((item) => item.start + item.duration <= current.start + 1e-4)
  if (!blocker) return next
  const start = Math.max(next.start, blocker.start + blocker.duration)
  const end = next.start + next.duration
  return { start, duration: Math.max(CAPTION_FRAME, end - start) }
}
