import type { CaptionWord } from "./composition.ts"

/** Lista inicial de palavras de venda. Frases entram inteiras. */
export const DEFAULT_SALE_TERMS = [
  "cupom",
  "cupons",
  "grátis",
  "gratis",
  "frete",
  "desconto",
  "promoção",
  "promocao",
  "promoções",
  "promocoes",
  "oferta",
  "ofertas",
  "hoje",
  "agora",
  "Saiba Mais",
  "link",
]

const MONEY = /^(?:r\$)\s*\d+(?:[.,]\d+)?$/i
const PERCENT = /^\d+(?:[.,]\d+)?%$/

export function bareSaleToken(text: string): string {
  return text.replace(/^[\s"'“”«»()[\]-]+|[\s"'“”«»()[\].,:;!?-]+$/g, "")
}

/**
 * Palavra ativa ganha a escala do karaokê.
 * Palavra de venda ganha a cor de destaque.
 * Quando as duas coincidem, a cor de venda permanece e a escala da palavra ativa soma.
 */
export const SALE_HIGHLIGHT_PRIORITY =
  "Palavra ativa aplica a escala. Palavra de venda aplica a cor de destaque. As duas juntas: cor de venda + escala da ativa."

function termKey(text: string): string {
  return bareSaleToken(text).toLocaleLowerCase("pt-BR")
}

export function saleNeedles(terms: readonly string[]): string[][] {
  const needles: string[][] = []
  const seen = new Set<string>()
  for (const term of terms) {
    const parts = term.trim().split(/\s+/).filter(Boolean).map(termKey)
    if (parts.length === 0) continue
    const key = parts.join(" ")
    if (seen.has(key)) continue
    seen.add(key)
    needles.push(parts)
  }
  needles.sort((a, b) => b.length - a.length)
  return needles
}

export function isSaleToken(text: string, terms: readonly string[]): boolean {
  const cleaned = bareSaleToken(text)
  if (!cleaned) return false
  if (MONEY.test(cleaned) || PERCENT.test(cleaned) || /^r\$$/i.test(cleaned)) return true
  const key = termKey(cleaned)
  return saleNeedles(terms).some((parts) => parts.length === 1 && parts[0] === key)
}

export function markSaleWords<T extends CaptionWord>(
  words: readonly T[],
  terms: readonly string[],
  enabled: boolean,
): T[] {
  if (!enabled) return words.map((word) => ({ ...word, emphasis: undefined }))
  const needles = saleNeedles(terms)
  const flags = words.map((word) => isSaleToken(word.text, terms))
  for (const parts of needles) {
    if (parts.length < 2) continue
    for (let index = 0; index <= words.length - parts.length; index += 1) {
      const match = parts.every((part, offset) => termKey(words[index + offset]!.text) === part)
      if (!match) continue
      for (let offset = 0; offset < parts.length; offset += 1) flags[index + offset] = true
    }
  }
  return words.map((word, index) => ({ ...word, emphasis: flags[index] ? true : undefined }))
}
