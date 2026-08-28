import type { TextPreset, TextPresetAnim } from "./schema.ts"

export type TextPresetCss = {
  fontFamily: string
  fontWeight: number
  fontStyle?: "italic"
  fontSize: number
  color: string
  letterSpacing: string
  lineHeight: number
  textTransform: "none" | "uppercase"
  textAlign: "left" | "center" | "right"
  maxWidth: number
  WebkitTextStroke?: string
  paintOrder?: string
  textShadow?: string
  transform?: string
  opacity?: number
  clipPath?: string
  backgroundColor?: string
  padding?: string
  borderRadius?: string
}

export type TextPresetLayer = {
  text: string
  style: TextPresetCss
}

export type TextPresetRender = {
  text: string
  fontSize: number
  strokeWidth: number
  padX: number
  padY: number
  radius: number
  maxWidth: number
  style: TextPresetCss
  layers?: TextPresetLayer[]
}

export type MeasureFn = (text: string, fontSize: number) => number

const DEFAULT_EASING = "cubic-bezier(.2,.8,.2,1)"

function cssFamily(family: string): string {
  return family.includes(" ") ? `"${family}", sans-serif` : `${family}, sans-serif`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function wrapPresetLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  measure: MeasureFn = (value, size) => value.length * size * 0.55,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && measure(next, fontSize) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function animCss(anim: TextPresetAnim, progress: number): Pick<TextPresetCss, "transform" | "opacity" | "clipPath"> {
  const t = clamp(progress, 0, 1)
  const rest = 1 - t
  void anim.easing
  void DEFAULT_EASING
  switch (anim.kind) {
    case "none":
      return { opacity: 1 }
    case "fade":
      return { opacity: t }
    case "fade-up":
      return { opacity: t, transform: `translateY(${rest * 24}px)` }
    case "pop":
      return { opacity: t, transform: `scale(${0.6 + 0.4 * t})` }
    case "slide-up":
      return { opacity: t, transform: `translateY(${rest * 40}px)` }
    case "wipe-left":
      return { opacity: 1, clipPath: `inset(0 ${rest * 100}% 0 0)` }
    case "stamp":
      return { opacity: t, transform: `scale(${1.45 - 0.45 * t}) rotate(${rest * -6}deg)` }
    case "typewriter":
      return { opacity: 1 }
    case "scale-x":
      return { opacity: 1, transform: `scaleX(${t})` }
    default:
      return { opacity: 1 }
  }
}

function typewriterText(text: string, progress: number): string {
  const count = Math.round(clamp(progress, 0, 1) * text.length)
  return text.slice(0, count)
}

export function renderTextPreset(
  preset: TextPreset,
  text: string,
  frameWidth: number,
  progress = 1,
  measure?: MeasureFn,
): TextPresetRender {
  const fontSize = preset.size.ratio * frameWidth
  const strokeWidth = preset.stroke ? preset.stroke.widthRatio * frameWidth : 0
  const padX = preset.box ? preset.box.padXRatio * frameWidth : 0
  const padY = preset.box ? preset.box.padYRatio * frameWidth : 0
  const radius =
    preset.box?.mode === "pill" || (preset.box?.radiusRatio ?? 0) >= 0.5
      ? 999
      : (preset.box?.radiusRatio ?? 0) * frameWidth
  const maxWidth = preset.maxWidthPct * frameWidth
  const display = preset.transform === "uppercase" ? text.toLocaleUpperCase("pt-BR") : text
  const visible = preset.animIn.kind === "typewriter" ? typewriterText(display, progress) : display
  const anim = animCss(preset.animIn, progress)
  const shadows = (preset.shadows ?? [])
    .map((shadow) => {
      const x = shadow.xRatio * frameWidth
      const y = shadow.yRatio * frameWidth
      const blur = shadow.blurRatio * frameWidth
      return `${x}px ${y}px ${blur}px ${shadow.color}`
    })
    .join(", ")

  const style: TextPresetCss = {
    fontFamily: cssFamily(preset.font.family),
    fontWeight: preset.font.weight,
    ...(preset.font.italic ? { fontStyle: "italic" as const } : {}),
    fontSize,
    color: preset.color,
    letterSpacing: `${preset.tracking}em`,
    lineHeight: preset.lineHeight,
    textTransform: preset.transform,
    textAlign: preset.align,
    maxWidth,
    ...anim,
    ...(preset.rotate ? { transform: [anim.transform, `rotate(${preset.rotate}deg)`].filter(Boolean).join(" ") } : {}),
  }
  if (strokeWidth > 0 && preset.stroke) {
    style.WebkitTextStroke = `${strokeWidth}px ${preset.stroke.color}`
    style.paintOrder = "stroke fill"
  }
  if (shadows) style.textShadow = shadows
  if (preset.box && preset.box.mode !== "none" && preset.box.mode !== "highlight-line") {
    style.backgroundColor = preset.box.color
    style.padding = `${padY}px ${padX}px`
    style.borderRadius = radius >= 999 ? "999px" : `${radius}px`
    if (preset.box.opacity < 1) {
      style.opacity = (style.opacity ?? 1) * preset.box.opacity
    }
  }

  const result: TextPresetRender = {
    text: visible,
    fontSize,
    strokeWidth,
    padX,
    padY,
    radius,
    maxWidth,
    style,
  }

  if (preset.box?.mode === "highlight-line") {
    result.layers = wrapPresetLines(visible, maxWidth, fontSize, measure).map((line) => ({
      text: line,
      style: {
        ...style,
        backgroundColor: preset.box!.color,
        padding: `${padY}px ${padX}px`,
        borderRadius: radius >= 999 ? "999px" : `${radius}px`,
      },
    }))
  }

  return result
}
