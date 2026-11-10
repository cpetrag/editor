import { layoutInsert } from "../paint/layout.ts"
import type { InsertStyle } from "../style/types.ts"
import { parseRuns } from "./runs.ts"

export type AnimationToken = {
  text: string
  kind: "word" | "space"
  accent?: boolean
  strike?: boolean
}

/** Palavras e espaços fora da marcação. O espaço fica entre as palavras, não dentro delas. */
export function animationTokens(input: string): AnimationToken[] {
  const tokens: AnimationToken[] = []
  for (const run of parseRuns(input)) {
    const parts = run.text.split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      const space = /^\s+$/.test(part)
      tokens.push({
        text: part,
        kind: space ? "space" : "word",
        ...(run.accent ? { accent: true } : {}),
        ...(run.strike ? { strike: true } : {}),
      })
    }
  }
  return tokens
}

export function animationPlainText(tokens: readonly AnimationToken[]): string {
  return tokens.map((token) => token.text).join("")
}

/** Largura reservada da linha, com o texto final. A animação não requebra. */
export function reservedLineWidths(text: string, style: InsertStyle): number[] {
  return layoutInsert(text, style).lines.map((line) => Math.round(line.width))
}
