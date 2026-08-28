export function captionWordsLookRelative(
  words: Array<{ start: number; end: number }>,
  insertStart: number,
  insertDuration: number,
): boolean {
  if (words.length === 0) return false
  if (!(insertStart > 1e-9)) return false
  let minStart = Number.POSITIVE_INFINITY
  let maxEnd = Number.NEGATIVE_INFINITY
  for (const word of words) {
    if (word.start < minStart) minStart = word.start
    if (word.end > maxEnd) maxEnd = word.end
  }
  if (minStart >= insertStart - 1e-9) return false
  return maxEnd <= insertDuration + 1e-6
}

export function toAbsoluteCaptionWords<T extends { start: number; end: number }>(
  words: T[],
  insertStart: number,
  insertDuration: number,
): T[] {
  if (!captionWordsLookRelative(words, insertStart, insertDuration)) return words
  return words.map((word) => ({
    ...word,
    start: word.start + insertStart,
    end: word.end + insertStart,
  }))
}

export function clampAbsoluteCaptionWords<T extends { start: number; end: number }>(
  words: T[],
  insertStart: number,
  insertDuration: number,
): T[] {
  const windowStart = insertStart
  const windowEnd = insertStart + insertDuration
  const next: T[] = []
  for (const word of words) {
    if (word.start >= windowEnd) continue
    if (word.end <= windowStart) continue
    const start = Math.max(word.start, windowStart)
    const end = Math.min(word.end, windowEnd)
    if (!(end > start)) continue
    next.push({ ...word, start, end })
  }
  return next
}
