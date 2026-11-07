import { graphemes as segmentGraphemes } from "../content/runs.ts"
import type { Animation, InsertStyle, TextStyle } from "./types.ts"

export type StrokeCss = {
  paintOrder?: string
  WebkitTextStroke?: string
  textShadow?: string
}

export type BackgroundCss = {
  display?: string
  boxDecorationBreak?: string
  WebkitBoxDecorationBreak?: string
  backgroundColor?: string
  padding?: string
  borderRadius?: string
  backdropFilter?: string
}

export type LineBox = {
  width: number
  y: number
  height: number
}

export type WordBox = {
  x: number
  y: number
  width: number
  height: number
}

export type BgRect = {
  x: number
  y: number
  w: number
  h: number
  r: number
}

export type LaidToken = {
  text: string
  x: number
  y: number
  width: number
  unitIndex: number
  wordIndex: number
}

function clampRadius(radius: number, w: number, h: number): number {
  if (radius >= 999) return Math.min(w, h) / 2
  return Math.min(radius, w / 2, h / 2)
}

export function circleTextShadows(width: number, color: string): string {
  const parts: string[] = []
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2
    const x = Math.round(Math.cos(angle) * width)
    const y = Math.round(Math.sin(angle) * width)
    parts.push(`${x}px ${y}px 0 ${color}`)
  }
  return parts.join(", ")
}

export function strokeCss(stroke: TextStyle["stroke"]): StrokeCss {
  if (!stroke.enabled || stroke.width <= 0) return {}
  const css: StrokeCss = {
    paintOrder: "stroke fill",
    WebkitTextStroke: `${stroke.width}px ${stroke.color}`,
  }
  if (stroke.width > 12) {
    css.textShadow = circleTextShadows(stroke.width, stroke.color)
  }
  return css
}

function cssColorWithOpacity(color: string, opacity: number): string {
  const t = Math.max(0, Math.min(100, opacity)) / 100
  if (t >= 1) return color
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const hex =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${t})`
  }
  return color
}

export function backgroundCss(bg: TextStyle["background"]): BackgroundCss {
  if (!bg.enabled) return {}
  const backgroundColor = cssColorWithOpacity(bg.color, bg.opacity)
  const borderRadius = bg.radius >= 999 ? "999px" : `${bg.radius}px`
  const padding = `${bg.paddingY}px ${bg.paddingX}px`
  if (bg.mode === "por-linha") {
    return {
      display: "inline",
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
      backgroundColor,
      padding,
      borderRadius,
    }
  }
  const css: BackgroundCss = {
    backgroundColor,
    padding,
    borderRadius,
  }
  if (bg.backdropBlur > 0) css.backdropFilter = `blur(${bg.backdropBlur}px)`
  return css
}

export function backgroundRects(input: {
  mode: TextStyle["background"]["mode"]
  blockW: number
  blockH: number
  lines: LineBox[]
  words: WordBox[]
  padX: number
  padY: number
  radius: number
}): BgRect[] {
  if (input.mode === "bloco") {
    const w = input.blockW + input.padX * 2
    const h = input.blockH + input.padY * 2
    return [
      {
        x: -input.blockW / 2 - input.padX,
        y: -input.blockH / 2 - input.padY,
        w,
        h,
        r: clampRadius(input.radius, w, h),
      },
    ]
  }
  if (input.mode === "por-linha") {
    return input.lines.map((line) => {
      const w = line.width + input.padX * 2
      const h = line.height + input.padY * 2
      return {
        x: -line.width / 2 - input.padX,
        y: line.y - line.height / 2 - input.padY,
        w,
        h,
        r: clampRadius(input.radius, w, h),
      }
    })
  }
  return input.words.map((word) => {
    const w = word.width + input.padX * 2
    const h = word.height + input.padY * 2
    return {
      x: word.x - input.padX,
      y: word.y - word.height / 2 - input.padY,
      w,
      h,
      r: clampRadius(input.radius, w, h),
    }
  })
}

export function layoutTextTokens(input: {
  lines: string[]
  unit: Animation["unit"]
  measure: (text: string) => number
  lineHeight: number
  blockH: number
  spaceWidth: number
  graphemes?: boolean
}): LaidToken[] {
  const tokens: LaidToken[] = []
  let wordIndex = 0
  let letterIndex = 0
  for (let lineIndex = 0; lineIndex < input.lines.length; lineIndex += 1) {
    const line = input.lines[lineIndex] ?? ""
    const pieces = line.split(/\s+/).filter(Boolean)
    const gapCount = Math.max(0, pieces.length - 1)
    const lineWidth =
      pieces.reduce((sum, piece) => sum + input.measure(piece), 0) + gapCount * input.spaceWidth
    let x = -lineWidth / 2
    const y = -input.blockH / 2 + input.lineHeight / 2 + lineIndex * input.lineHeight
    for (const piece of pieces) {
      if (input.unit === "letra") {
        const chars = input.graphemes ? segmentGraphemes(piece) : [...piece]
        for (const char of chars) {
          const width = input.measure(char)
          tokens.push({
            text: char,
            x,
            y,
            width,
            unitIndex: letterIndex,
            wordIndex,
          })
          x += width
          letterIndex += 1
        }
        x += input.spaceWidth
      } else {
        const width = input.measure(piece)
        tokens.push({
          text: piece,
          x,
          y,
          width,
          unitIndex: input.unit === "bloco" ? 0 : wordIndex,
          wordIndex,
        })
        x += width + input.spaceWidth
      }
      wordIndex += 1
    }
  }
  return tokens
}
