import type { TextStyle } from "./types.ts"

export type CaptionTimeWord = {
  text: string
  start: number
  end: number
  emphasis?: boolean
}

export type WordPaint = {
  fill: string
  scale: number
  karaoke: number | null
  boxColor: string | null
}

/** Spec: /\d+([.,]\d+)?%?/ plus R$ when keywords is empty. Non-global to avoid lastIndex bugs. */
export const AUTO_KEYWORD_RE = /^(?:R\$\s*)?\d+(?:[.,]\d+)?%?$|^R\$$|^%$/i

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export function activeWordIndex(words: readonly CaptionTimeWord[], time: number): number {
  if (words.length === 0) return -1
  const first = words[0]
  if (!first || time < first.start) return -1
  let previous = -1
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (!word) continue
    if (time >= word.start && time < word.end) return index
    if (time >= word.end) previous = index
  }
  return previous
}

export function karaokeProgress(word: CaptionTimeWord, time: number): number {
  const span = word.end - word.start
  if (!(span > 0)) return time >= word.end ? 1 : 0
  return clamp01((time - word.start) / span)
}

export function karaokeClipPath(progress: number): string {
  const p = clamp01(progress)
  return `inset(0 ${(1 - p) * 100}% 0 0)`
}

function stripEdgePunct(token: string): string {
  return token.replace(/^[\s,.;:!?“”"']+|[\s,.;:!?“”"']+$/g, "")
}

export function isKeywordToken(token: string, keywords: readonly string[]): boolean {
  const cleaned = stripEdgePunct(token)
  if (!cleaned) return false
  if (keywords.length > 0) {
    const needle = cleaned.toLocaleLowerCase("pt-BR")
    return keywords.some((keyword) => keyword.toLocaleLowerCase("pt-BR") === needle)
  }
  return AUTO_KEYWORD_RE.test(cleaned)
}

/**
 * Prioridade: a palavra ativa aplica a escala do karaokê.
 * A palavra de venda (emphasis) aplica a cor de destaque.
 * Quando as duas coincidem, a cor de venda permanece e a escala da ativa soma.
 */
export function wordHighlight(input: {
  token: string
  word?: CaptionTimeWord
  time: number
  isActive: boolean
  highlight: TextStyle["highlight"]
  baseColor: string
}): WordPaint {
  const { highlight, baseColor } = input
  const idle: WordPaint = {
    fill: baseColor,
    scale: 1,
    karaoke: null,
    boxColor: null,
  }
  if (highlight.mode === "nenhum") {
    if (!input.word?.emphasis) return idle
    return { fill: highlight.color, scale: 1, karaoke: null, boxColor: null }
  }

  if (highlight.mode === "karaoke-fill") {
    const progress = input.word ? karaokeProgress(input.word, input.time) : 0
    return {
      fill: input.word?.emphasis ? highlight.color : baseColor,
      scale: 1,
      karaoke: progress,
      boxColor: highlight.boxColor,
    }
  }

  if (highlight.mode === "palavra-ativa") {
    if (input.isActive) {
      return {
        fill: highlight.color,
        scale: highlight.scale,
        karaoke: null,
        boxColor: highlight.boxColor,
      }
    }
    if (input.word?.emphasis) {
      return { fill: highlight.color, scale: 1, karaoke: null, boxColor: null }
    }
    return idle
  }

  if (input.word?.emphasis || isKeywordToken(input.token, highlight.keywords)) {
    return {
      fill: highlight.color,
      scale: highlight.scale,
      karaoke: null,
      boxColor: highlight.boxColor,
    }
  }
  return idle
}
