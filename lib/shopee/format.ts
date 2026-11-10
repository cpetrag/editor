export function formatRating(rating: number): string {
  return rating.toFixed(1).replace(".", ",")
}

export function formatSold(sold: number): string {
  const value = Math.max(0, Math.round(sold))
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10
    const body = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",")
    return `+${body} ${rounded >= 2 ? "milhões" : "milhão"}`
  }
  if (value >= 1000) {
    const thousands = value / 1000
    const rounded = thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10
    const body = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",")
    return `+${body} mil`
  }
  return `+${value}`
}

export function formatSoldLabel(sold: number): string {
  return `${formatSold(sold)} vendidos`
}

const PRICE_TOKEN = /\{(?:preco_de|preco|desconto|cupom)\}/

export function presetUsesPrice(text: string): boolean {
  return PRICE_TOKEN.test(text)
}

export function literalExcerpt(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if ([...clean].length <= max) return clean
  const slice = [...clean].slice(0, max - 1).join("")
  const cut = slice.replace(/\s+\S*$/, "").trim()
  const body = cut.length >= 12 ? cut : slice.trim()
  return `${body}…`
}

export function fallbackShortName(title: string): string {
  const words = title.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, 4)
  return words.join(" ")
}

const MATERIAL_QUALIFIERS = ["pu", "sintetico", "eco", "replica", "inspired", "tipo", "similar"] as const

function foldedTokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/**
 * "Couro PU" não pode virar "couro". Sem o qualificador, o material sai do nome
 * curto; se a IA deixou "couro" sem PU/sintético/…, vale o recorte literal.
 */
export function acceptShortName(title: string, candidate: string): string {
  const clean = candidate.replace(/["“”]/g, "").replace(/\s+/g, " ").trim()
  const words = clean.split(" ").filter(Boolean)
  if (words.length < 2 || words.length > 4 || dropsMaterialQualifier(title, clean)) return fallbackShortName(title)
  return clean
}

export function dropsMaterialQualifier(title: string, shortName: string): boolean {
  const titleTokens = new Set(foldedTokens(title))
  const shortTokens = new Set(foldedTokens(shortName))
  if (!shortTokens.has("couro")) return false
  const required = MATERIAL_QUALIFIERS.filter((qualifier) => titleTokens.has(qualifier))
  if (required.length === 0) return false
  return required.some((qualifier) => !shortTokens.has(qualifier))
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function capitalizePhrase(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  return trimmed.charAt(0).toLocaleUpperCase("pt-BR") + trimmed.slice(1)
}

function takeChars(text: string, max: number): string {
  return [...text].slice(0, max).join("")
}

/**
 * Trecho completo de até 60 caracteres, copiado do texto.
 * Passa de 60, ou termina em reticências, recua até vírgula ou fim de frase.
 */
export function clipPhrase(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return ""
  const within = takeChars(clean, max)
  const incomplete = [...clean].length > max || /(?:\.{3}|…)\s*$/u.test(within)
  if (!incomplete) return capitalizePhrase(within)
  const window = within.replace(/(?:\.{3}|…)+\s*$/u, "").trimEnd()
  let at = -1
  for (const mark of [".", "!", "?", ",", ";"]) {
    const idx = window.lastIndexOf(mark)
    if (idx > at) at = idx
  }
  const body = at >= 8 ? window.slice(0, at).trim() : window.replace(/\s+\S*$/u, "").trim() || window.trim()
  return capitalizePhrase(body)
}

/** A frase da IA só entra se for um trecho do texto, com no máximo 60 caracteres. */
export function acceptExtractedPhrase(source: string, candidate: string): string {
  const clean = candidate.replace(/^["“”']+|["“”']+$/g, "").replace(/\s+/g, " ").trim()
  if (!clean || [...clean].length > 60) return literalExcerpt(source)
  const sourceFold = fold(source)
  const phraseFold = fold(clean.replace(/…$/u, ""))
  if (!phraseFold || !sourceFold.includes(phraseFold)) return literalExcerpt(source)
  return clean
}

/** Trecho copiado: só a maiúscula inicial muda. Fora do texto, vale o recorte por vírgula. */
export function acceptCopiedPhrase(source: string, candidate: string): string {
  const clean = candidate.replace(/^["“”']+|["“”']+$/g, "").replace(/\s+/g, " ").trim()
  const sourceFold = fold(source)
  const phraseFold = fold(clean.replace(/(?:\.{3}|…)$/u, ""))
  const copied = Boolean(phraseFold) && sourceFold.includes(phraseFold) && [...clean].length <= 60
  if (!clean || !copied || /(?:\.{3}|…)\s*$/u.test(clean)) return clipPhrase(source)
  return capitalizePhrase(clean)
}

export function numbersIn(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?/g) ?? []
}
