export interface TextPresetPaint {
  color: string
  uppercase?: boolean
  fontWeight?: number
  bgColor?: string
  bgOpacity?: number
  pillRadius?: number
  stroke?: { width: number; color: string }
}

export const TEXT_PRESETS: Array<{ id: string; label: string }> = [
  { id: "bold-outline", label: "Outline" },
  { id: "caption-clean", label: "Limpo" },
  { id: "sticker-quero", label: "CTA Shopee" },
  { id: "caption-box", label: "Caixa" },
]

const PAINT: Record<string, TextPresetPaint> = {
  "bold-outline": {
    color: "#ffffff",
    fontWeight: 800,
    stroke: { width: 6, color: "#000000" },
  },
  "caption-clean": {
    color: "#ffffff",
    fontWeight: 700,
    stroke: { width: 6, color: "#111111" },
  },
  "sticker-quero": {
    color: "#ffffff",
    fontWeight: 800,
    bgColor: "#ee4d2d",
    bgOpacity: 1,
    pillRadius: 999,
  },
  "caption-box": {
    color: "#ffffff",
    fontWeight: 700,
    bgColor: "#000000",
    bgOpacity: 0.72,
    pillRadius: 8,
  },
}

export function presetPaint(preset: string | undefined): TextPresetPaint {
  return PAINT[preset ?? ""] ?? PAINT["bold-outline"]!
}
