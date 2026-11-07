export const PRODUCT_FIELDS = [
  "produto",
  "preco",
  "preco_de",
  "desconto",
  "cupom",
  "nota",
  "vendidos",
  "tamanhos",
  "qtd",
] as const

export type ProductField = (typeof PRODUCT_FIELDS)[number]

export type ProductData = Partial<Record<ProductField, string>>

export type TextRun = {
  text: string
  accent?: boolean
  strike?: boolean
}

export type TextSpan = {
  start: number
  end: number
  accent?: boolean
  strike?: boolean
  missing?: boolean
}

const VAR_PATTERN = /\{(produto|preco_de|preco|desconto|cupom|nota|vendidos|tamanhos|qtd)\}/g

export function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
    return [...segmenter.segment(text)].map((part) => part.segment)
  }
  return [...text]
}

function findMarkerEnd(input: string, from: number, marker: "*" | "~~"): number {
  for (let index = from; index < input.length; index += 1) {
    if (input[index] === "\\" && (input[index + 1] === "*" || input[index + 1] === "~")) {
      index += 1
      continue
    }
    if (input.startsWith(marker, index)) return index
  }
  return -1
}

function hasForeignMarker(slice: string, mode: "accent" | "strike"): boolean {
  for (let index = 0; index < slice.length; index += 1) {
    if (slice[index] === "\\" && (slice[index + 1] === "*" || slice[index + 1] === "~")) {
      index += 1
      continue
    }
    if (mode === "accent" && slice.startsWith("~~", index)) return true
    if (mode === "strike" && slice[index] === "*") return true
  }
  return false
}

/** `*destaque*` e `~~riscado~~`. `\*` e `\~` viram o caractere. Aninhamento inválido fica texto. */
export function parseRuns(input: string): TextRun[] {
  const runs: TextRun[] = []
  let buffer = ""
  let index = 0

  const flush = () => {
    if (!buffer) return
    runs.push({ text: buffer })
    buffer = ""
  }

  while (index < input.length) {
    if (input[index] === "\\" && (input[index + 1] === "*" || input[index + 1] === "~")) {
      buffer += input[index + 1]
      index += 2
      continue
    }
    if (input.startsWith("~~", index)) {
      const close = findMarkerEnd(input, index + 2, "~~")
      const inside = close < 0 ? "" : input.slice(index + 2, close)
      if (close >= 0 && hasForeignMarker(inside, "strike")) {
        buffer += input.slice(index, close + 2)
        index = close + 2
        continue
      }
      if (close < 0) {
        buffer += "~~"
        index += 2
        continue
      }
      flush()
      if (inside) runs.push({ text: inside, strike: true })
      index = close + 2
      continue
    }
    if (input[index] === "*") {
      const close = findMarkerEnd(input, index + 1, "*")
      const inside = close < 0 ? "" : input.slice(index + 1, close)
      if (close >= 0 && hasForeignMarker(inside, "accent")) {
        buffer += input.slice(index, close + 1)
        index = close + 1
        continue
      }
      if (close < 0) {
        buffer += "*"
        index += 1
        continue
      }
      flush()
      if (inside) runs.push({ text: inside, accent: true })
      index = close + 1
      continue
    }
    buffer += input[index]
    index += 1
  }

  flush()
  return runs.length > 0 ? runs : [{ text: "" }]
}

/** "49,9" e "49.90" viram "R$ 49,90". Valor já formatado permanece. */
export function formatPrice(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  let body = trimmed.replace(/^r\$\s*/i, "").replace(/\s/g, "")
  if (!/\d/.test(body)) return trimmed
  if (body.includes(",")) body = body.replace(/\./g, "").replace(",", ".")
  else if (!/^\d+\.\d{1,2}$/.test(body)) body = body.replace(/\./g, "")
  const value = Number(body)
  if (!Number.isFinite(value)) return trimmed
  const [whole, fraction] = value.toFixed(2).split(".")
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `R$ ${grouped},${fraction}`
}

export function normalizeProductData(data: ProductData | undefined): ProductData {
  if (!data) return {}
  const next: ProductData = { ...data }
  if (next.preco) next.preco = formatPrice(next.preco)
  if (next.preco_de) next.preco_de = formatPrice(next.preco_de)
  return next
}

export function fillVars(
  text: string,
  data: ProductData | undefined,
  options?: { stripEmpty?: boolean },
): { text: string; empty: ProductField[] } {
  const source = data ?? {}
  const empty: ProductField[] = []
  const next = text.replace(VAR_PATTERN, (token, key: ProductField) => {
    const value = (source[key] ?? "").trim()
    if (!value) {
      if (!empty.includes(key)) empty.push(key)
      return options?.stripEmpty ? "" : token
    }
    return value
  })
  return { text: next.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n"), empty }
}

export function displayRuns(
  text: string,
  data: ProductData | undefined,
  options?: { stripEmpty?: boolean; uppercase?: boolean },
): { plain: string; spans: TextSpan[]; empty: ProductField[] } {
  const filled = fillVars(text, data, { stripEmpty: options?.stripEmpty })
  const runs = parseRuns(filled.text)
  const spans: TextSpan[] = []
  let plain = ""
  for (const run of runs) {
    const visible =
      options?.uppercase && !run.accent
        ? run.text
            .split(/(\{(?:produto|preco_de|preco|desconto|cupom|nota|vendidos|tamanhos|qtd)\})/g)
            .map((part) => (part.startsWith("{") ? part : part.toLocaleUpperCase("pt-BR")))
            .join("")
        : run.text
    const start = plain.length
    plain += visible
    const missing = /\{(produto|preco_de|preco|desconto|cupom|nota|vendidos|tamanhos|qtd)\}/.test(visible)
    if (run.accent || run.strike || missing) {
      spans.push({
        start,
        end: plain.length,
        ...(run.accent ? { accent: true } : {}),
        ...(run.strike ? { strike: true } : {}),
        ...(missing ? { missing: true } : {}),
      })
    }
  }
  return { plain, spans, empty: filled.empty }
}

export function tagToken(
  spans: TextSpan[],
  start: number,
  end: number,
): { accent?: boolean; strike?: boolean; missing?: boolean } {
  const hit = spans.find((span) => start < span.end && end > span.start)
  if (!hit) return {}
  return {
    ...(hit.accent ? { accent: true } : {}),
    ...(hit.strike ? { strike: true } : {}),
    ...(hit.missing ? { missing: true } : {}),
  }
}

export function priceError(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const body = trimmed.replace(/^r\$\s*/i, "")
  if (!body || !/^[\d.,]+$/.test(body)) return "Use 49,90"
  return null
}

export function markupIssues(text: string): string[] {
  const stars: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\\" && (text[index + 1] === "*" || text[index + 1] === "~")) {
      index += 1
      continue
    }
    if (text[index] === "*") stars.push(index)
  }
  if (stars.length % 2 === 0) return []
  const at = stars[stars.length - 1] ?? 0
  return [`Marcação ignorada: * sem par na posição ${at}`]
}

export function plainMarkedText(text: string, data?: ProductData): string {
  const filled = fillVars(text, data, { stripEmpty: true })
  return parseRuns(filled.text)
    .map((run) => run.text)
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function readingSeconds(text: string): number {
  const words = text
    .replace(/[{}*~\\]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 0
  return 0.6 + 0.25 * words.length
}
