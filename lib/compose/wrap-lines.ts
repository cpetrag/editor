function breakLongToken(
  token: string,
  maxWidth: number,
  measureWidth: (value: string) => number,
): string[] {
  if (measureWidth(token) <= maxWidth) return [token]
  const pieces: string[] = []
  let current = ""
  for (const char of token) {
    const candidate = current + char
    if (current && measureWidth(candidate) > maxWidth) {
      pieces.push(current)
      current = char
      continue
    }
    current = candidate
  }
  if (current) pieces.push(current)
  return pieces.length > 0 ? pieces : [token]
}

export function wrapLines(
  text: string,
  maxWidth: number,
  measureWidth: (value: string) => number,
  breakWords = true,
): string[] {
  const paragraphs = text.replace(/\r/g, "").split("\n")
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push("")
      continue
    }
    let current = ""
    const flush = () => {
      if (current) {
        lines.push(current)
        current = ""
      }
    }
    for (const word of words) {
      if (breakWords && measureWidth(word) > maxWidth) {
        flush()
        const pieces = breakLongToken(word, maxWidth, measureWidth)
        for (const piece of pieces) {
          if (!current) {
            current = piece
            continue
          }
          if (measureWidth(current + piece) <= maxWidth) {
            current += piece
            continue
          }
          lines.push(current)
          current = piece
        }
        continue
      }
      const candidate = current ? `${current} ${word}` : word
      if (measureWidth(candidate) <= maxWidth) {
        current = candidate
      } else {
        flush()
        current = word
      }
    }
    flush()
  }
  return lines
}
