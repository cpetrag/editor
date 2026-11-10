import { brandKitOf } from "../brand/kits.ts"
import { resolveStyleColors } from "../brand/resolve-style-colors.ts"
import { fillVars, parseRuns, type ProductData } from "../content/runs.ts"
import { canvasFontFamily } from "../compose/fonts.ts"
import type { InsertStyle } from "../style/types.ts"

export type MeasureFont = {
  family: string
  weight: number
  size: number
  italic?: boolean
  letterSpacing?: number
}

export type PaintPiece = {
  text: string
  x: number
  y: number
  width: number
  font: MeasureFont
  color: string
  strike?: boolean
  accent?: boolean
  missing?: boolean
  /** Sobe o glifo, em px. */
  rise: number
  opacity: number
}

export type PaintLine = {
  y: number
  height: number
  width: number
  pieces: PaintPiece[]
}

export type InsertPaintLayout = {
  lines: PaintLine[]
  pieces: PaintPiece[]
  bbox: { x: number; y: number; w: number; h: number }
  blockW: number
  blockH: number
}

export type LayoutMeasure = (text: string, font: MeasureFont) => number

const VAR_CHUNK = /(\{(?:produto|preco_de|preco|desconto|cupom|nota|vendidos|tamanhos|qtd)\})/g

function cssFamily(id: string): string {
  return canvasFontFamily(id).split(",")[0]?.replace(/"/g, "").trim() || "sans-serif"
}

function caseOf(text: string, upper: boolean): string {
  if (!upper) return text
  return text
    .split(VAR_CHUNK)
    .map((part) => (part.startsWith("{") ? part : part.toLocaleUpperCase("pt-BR")))
    .join("")
}

function widthOf(text: string, font: MeasureFont, measure: LayoutMeasure): number {
  const base = measure(text, font)
  const tracking = (font.letterSpacing ?? 0) * font.size * Math.max(0, [...text].length - 1)
  return base + tracking
}

type Chunk = {
  text: string
  font: MeasureFont
  color: string
  strike?: boolean
  accent?: boolean
  missing?: boolean
  rise: number
  opacity: number
  /** Espaço antes deste trecho, quando ele não abre a linha. `0` cola no anterior. */
  gapBefore?: number
}

function priceChunks(text: string, font: MeasureFont, color: string, accent: boolean): Chunk[] | null {
  const match = text.match(/^(R\$)\s*(\d[\d.]*)(,\d{2})$/)
  if (!match) return null
  const main = font.size
  const symbol = main * 0.42
  const cents = main * 0.45
  return [
    {
      text: match[1] ?? "R$",
      font: { ...font, size: symbol, letterSpacing: 0 },
      color,
      accent,
      rise: symbol * 1.05,
      opacity: 1,
      gapBefore: 0,
    },
    {
      text: match[2] ?? "",
      font,
      color,
      accent,
      rise: 0,
      opacity: 1,
      gapBefore: main * 0.12,
    },
    {
      text: match[3] ?? "",
      font: { ...font, size: cents, letterSpacing: 0 },
      color,
      accent,
      rise: cents * 0.95,
      opacity: 1,
      gapBefore: 0,
    },
  ]
}

function chunksForRun(
  text: string,
  flags: { accent?: boolean; strike?: boolean },
  style: InsertStyle,
  editPreview: boolean,
): Chunk[] {
  const upper = style.text.textTransform === "uppercase"
  const accentFont = flags.accent && style.text.accentFont ? style.text.accentFont : style.text.fontFamily
  const size = flags.accent && style.text.accentFont ? style.text.fontSize * 1.12 : style.text.fontSize
  const base: MeasureFont = {
    family: cssFamily(flags.strike ? style.text.fontFamily : accentFont),
    weight: style.text.fontWeight,
    size: flags.strike ? style.text.fontSize * 0.5 : size,
    italic: flags.accent ? false : style.text.italic,
    letterSpacing: flags.accent || flags.strike ? 0 : style.text.letterSpacing,
  }
  const color = flags.accent
    ? style.text.accent || style.text.highlight.color || "#FFD400"
    : style.text.color
  const parts = text.split(VAR_CHUNK).filter((part) => part.length > 0)
  const chunks: Chunk[] = []
  for (const part of parts) {
    const missing = part.startsWith("{") && part.endsWith("}")
    if (missing && !editPreview) continue
    if (missing) {
      chunks.push({
        text: part,
        font: { family: "Courier Prime", weight: 700, size: style.text.fontSize * 0.72, letterSpacing: 0 },
        color: "#9A5B00",
        missing: true,
        accent: flags.accent,
        strike: flags.strike,
        rise: 0,
        opacity: 1,
      })
      continue
    }
    const scriptAccent = Boolean(flags.accent && style.text.accentFont)
    const visible = caseOf(part, upper && !scriptAccent)
    if (style.text.priceLayout && flags.accent) {
      const priced = priceChunks(visible, { ...base, size: style.text.fontSize }, color, true)
      if (priced) {
        chunks.push(...priced)
        continue
      }
    }
    chunks.push({
      text: visible,
      font: base,
      color: style.text.color === "transparent" && !flags.accent ? "transparent" : color,
      accent: flags.accent,
      strike: flags.strike,
      rise: flags.strike ? base.size * 0.55 : 0,
      opacity: flags.strike ? 0.9 : 1,
    })
  }
  return chunks.filter((chunk) => chunk.text.length > 0)
}

export function layoutMarkedText(input: {
  text: string
  style: InsertStyle
  maxWidth: number
  measure: LayoutMeasure
  productData?: ProductData
  editPreview?: boolean
  brandKitId?: string
}): InsertPaintLayout {
  const style = resolveStyleColors(input.style, brandKitOf(input.brandKitId))
  const filled = fillVars(input.text, input.productData, { stripEmpty: !input.editPreview })
  const runs = parseRuns(filled.text)
  const chunks: Chunk[] = []
  for (const run of runs) {
    chunks.push(...chunksForRun(run.text, run, style, Boolean(input.editPreview)))
  }

  const main = Math.max(1, style.text.fontSize)
  const lineHeight = (style.text.textTransform === "uppercase" ? 1.04 : 1.12) * main
  const spaceFont: MeasureFont = {
    family: cssFamily(style.text.fontFamily),
    weight: style.text.fontWeight,
    size: main,
    italic: style.text.italic,
  }
  // O canvas sem a fonte (ou com letterSpacing residual) mede o espaço como 0 e cola as palavras.
  const space = Math.max(input.measure(" ", spaceFont), spaceFont.size * 0.25)

  const lines: PaintLine[] = []
  let current: Chunk[] = []
  let currentWidth = 0

  const flush = () => {
    if (current.length === 0) {
      lines.push({ y: 0, height: lineHeight, width: 0, pieces: [] })
      return
    }
    lines.push({ y: 0, height: lineHeight, width: currentWidth, pieces: [] })
    const line = lines[lines.length - 1]
    if (!line) return
    let x = -currentWidth / 2
    const pieces: PaintPiece[] = []
    for (const chunk of current) {
      const gap = pieces.length > 0 ? (chunk.gapBefore ?? space) : 0
      x += gap
      const width = widthOf(chunk.text, chunk.font, input.measure)
      pieces.push({ ...chunk, x, y: 0, width })
      x += width
    }
    line.pieces = pieces
    current = []
    currentWidth = 0
  }

  const pushChunk = (chunk: Chunk, width: number) => {
    const gap = current.length > 0 ? (chunk.gapBefore ?? space) : 0
    if (current.length > 0 && currentWidth + gap + width > input.maxWidth && input.maxWidth > 0) flush()
    const usedGap = current.length > 0 ? (chunk.gapBefore ?? space) : 0
    current.push({ ...chunk, gapBefore: usedGap })
    currentWidth += usedGap + width
  }

  for (const chunk of chunks) {
    if (chunk.text.includes("\n")) {
      const bits = chunk.text.split("\n")
      bits.forEach((bit, index) => {
        if (index > 0) flush()
        if (!bit) return
        pushChunk({ ...chunk, text: bit }, widthOf(bit, chunk.font, input.measure))
      })
      continue
    }
    if (chunk.strike) {
      pushChunk(chunk, widthOf(chunk.text, chunk.font, input.measure))
      continue
    }
    const words = chunk.text.split(/(\s+)/)
    for (const word of words) {
      if (!word) continue
      if (/^\s+$/.test(word)) continue
      pushChunk({ ...chunk, text: word }, widthOf(word, chunk.font, input.measure))
    }
  }
  if (current.length > 0 || lines.length === 0) flush()

  const blockH = Math.max(lineHeight, lines.length * lineHeight)
  lines.forEach((line, index) => {
    const y = -blockH / 2 + lineHeight / 2 + index * lineHeight
    line.y = y
    for (const piece of line.pieces) piece.y = y - piece.rise
  })

  const pieces = lines.flatMap((line) => line.pieces)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const grow = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  for (const piece of pieces) {
    grow(piece.x, piece.y - piece.font.size * 0.7, piece.width, piece.font.size * 1.2)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    minY = -lineHeight / 2
    maxX = 1
    maxY = lineHeight / 2
  }
  const padX = style.text.background.enabled ? style.text.background.paddingX : 0
  const padY = style.text.background.enabled ? style.text.background.paddingY : 0
  const bbox = {
    x: minX - padX,
    y: minY - padY,
    w: Math.max(1, maxX - minX) + padX * 2,
    h: Math.max(1, maxY - minY) + padY * 2,
  }
  return {
    lines,
    pieces,
    bbox,
    blockW: bbox.w,
    blockH: bbox.h,
  }
}

/** Largura estável: o canvas sem a fonte carregada mede o espaço como zero e cola as palavras. */
export function spacedMeasure(text: string, font: MeasureFont): number {
  return text.length * Math.max(0, font.size) * 0.5
}

/** Layout com espaços entre palavras. Usado pelo preview, pela miniatura e pelo teste. */
export function layoutInsert(
  text: string,
  style: InsertStyle,
  maxWidth = 20000,
  measure: LayoutMeasure = spacedMeasure,
): InsertPaintLayout {
  return layoutMarkedText({
    text,
    style,
    maxWidth,
    measure,
    editPreview: true,
  })
}

/** Linha do riscado: mesma largura do run, cruzando os glifos. */
export function strikeLine(piece: PaintPiece): { x0: number; x1: number; y: number; thickness: number } | null {
  if (!piece.strike) return null
  const xHeight = piece.font.size * 0.5
  return {
    x0: piece.x,
    x1: piece.x + piece.width,
    y: piece.y - xHeight * 0.15,
    thickness: piece.font.size * 0.09,
  }
}
