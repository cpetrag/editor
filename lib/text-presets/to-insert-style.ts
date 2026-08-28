import {
  DEFAULT_TEXT_X,
  DEFAULT_TEXT_Y,
  type CompositionInsert,
} from "../composition.ts"
import { parseFontId, type FontId, type FontWeight, type InsertStyle as ComposeInsertStyle } from "../compose/insert-style.ts"
import { deepMerge } from "../style/deep-merge.ts"
import type { InsertStyle } from "../style/types.ts"
import { getTextPreset, isTextPresetId } from "./catalog.ts"
import type { TextPreset, TextPresetAnim } from "./schema.ts"

export type TextPresetLayout = {
  x?: number
  y?: number
  fontSize?: number
  rotation?: number
}

const FAMILY_TO_ID: Record<string, string> = {
  Anton: "anton",
  Inter: "inter",
  Poppins: "poppins",
  "Archivo Black": "archivo",
  Caveat: "caveat",
  "Courier Prime": "courier",
}

export function fontIdFromFamily(family: string): string {
  const mapped = FAMILY_TO_ID[family] ?? family.toLowerCase().replace(/\s+/g, "-")
  return parseFontId(mapped) ?? parseFontId(family) ?? mapped
}

function framesFromMs(ms: number, fps = 30): number {
  if (ms <= 0) return 0
  return Math.max(1, Math.round((ms / 1000) * fps))
}

function animToEnter(anim: TextPresetAnim, fps = 30): InsertStyle["animation"]["enter"] {
  const durationInFrames = framesFromMs(anim.durationMs, fps)
  const staggerInFrames = anim.charStaggerMs ? framesFromMs(anim.charStaggerMs, fps) : 0
  const from: InsertStyle["animation"]["enter"]["from"] = (() => {
    switch (anim.kind) {
      case "fade":
        return { opacity: 0 }
      case "fade-up":
        return { opacity: 0, y: 24 }
      case "pop":
        return { scale: 0.6, opacity: 0 }
      case "slide-up":
        return { y: 40, opacity: 0 }
      case "wipe-left":
        return { opacity: 0, x: 24 }
      case "stamp":
        return { scale: 1.45, rotate: -6, opacity: 0 }
      case "typewriter":
        return { opacity: 0 }
      case "scale-x":
        return { scale: 0.2, opacity: 0 }
      default:
        return {}
    }
  })()
  const spring = anim.kind === "pop" || anim.kind === "stamp"
  return {
    from,
    durationInFrames,
    delayInFrames: 0,
    easing: spring ? "spring" : "ease-out",
    overshoot: spring ? 0.12 : 0,
    staggerInFrames,
  }
}

export function textPresetToInsertStyle(
  preset: TextPreset,
  frameWidth: number,
  layout: TextPresetLayout = {},
): InsertStyle {
  const fontSize = layout.fontSize ?? preset.size.ratio * frameWidth
  const strokeWidth = preset.stroke ? preset.stroke.widthRatio * frameWidth : 0
  const box = preset.box
  const padX = box ? box.padXRatio * frameWidth : 0
  const padY = box ? box.padYRatio * frameWidth : 0
  const pill = box?.mode === "pill" || (box?.radiusRatio ?? 0) >= 0.5
  const radius = box ? (pill ? 999 : box.radiusRatio * frameWidth) : 0
  const highlightLine = box?.mode === "highlight-line"
  const blockBox = box && box.mode !== "none"

  return {
    text: {
      fontFamily: fontIdFromFamily(preset.font.family),
      fontWeight: preset.font.weight,
      fontSize,
      letterSpacing: preset.tracking,
      lineHeight: preset.lineHeight,
      textTransform: preset.transform,
      textAlign: preset.align,
      maxWidth: preset.maxWidthPct * 100,
      color: preset.color,
      gradient: { enabled: false, from: "#fff", to: "#fff", angle: 0 },
      stroke: {
        enabled: strokeWidth > 0,
        width: strokeWidth,
        color: preset.stroke?.color ?? "#000000",
      },
      shadows: (preset.shadows ?? []).map((shadow) => ({
        x: shadow.xRatio * frameWidth,
        y: shadow.yRatio * frameWidth,
        blur: shadow.blurRatio * frameWidth,
        color: shadow.color,
      })),
      background: {
        enabled: Boolean(blockBox),
        mode: highlightLine ? "por-linha" : "bloco",
        color: box?.color ?? "#000000",
        opacity: box ? Math.round(box.opacity * 100) : 0,
        paddingX: padX,
        paddingY: padY,
        radius,
        backdropBlur: 0,
      },
      highlight: {
        mode: "nenhum",
        color: "#FFE500",
        boxColor: highlightLine ? (box?.color ?? "#FFE500") : null,
        scale: 1,
        keywords: [],
      },
      x: layout.x ?? 50,
      y: layout.y ?? 35,
      rotation: layout.rotation ?? preset.rotate ?? 0,
      opacity: 100,
    },
    animation: {
      unit: preset.animIn.kind === "typewriter" ? "letra" : "bloco",
      enter: animToEnter(preset.animIn),
      exit: {
        to: preset.animOut.kind === "none" ? {} : { opacity: 0 },
        durationInFrames: framesFromMs(preset.animOut.durationMs),
        easing: "ease-out",
      },
      loop: { type: "nenhum", amplitude: 0, speed: 0 },
    },
  }
}

export function overlayComposeInsertStyle(
  painted: InsertStyle,
  compose?: {
    fontFamily?: string
    fontWeight?: number
    uppercase?: boolean
    color?: string
    bgColor?: string | null
    strokeWidth?: number
    strokeColor?: string
    opacity?: number
    rotation?: number
  },
): InsertStyle {
  if (!compose) return painted
  return deepMerge(painted, {
    text: {
      ...(compose.fontFamily ? { fontFamily: compose.fontFamily } : {}),
      ...(typeof compose.fontWeight === "number" ? { fontWeight: compose.fontWeight } : {}),
      ...(compose.uppercase === true ? { textTransform: "uppercase" as const } : {}),
      ...(compose.uppercase === false ? { textTransform: "none" as const } : {}),
      ...(compose.color ? { color: compose.color } : {}),
      ...(compose.strokeWidth !== undefined
        ? {
            stroke: {
              enabled: compose.strokeWidth > 0,
              width: compose.strokeWidth,
              color: compose.strokeColor ?? painted.text.stroke.color,
            },
          }
        : {}),
      ...(compose.bgColor
        ? { background: { enabled: true, color: compose.bgColor } }
        : compose.bgColor === null
          ? { background: { enabled: false } }
          : {}),
      ...(compose.opacity !== undefined ? { opacity: Math.round(compose.opacity * 100) } : {}),
      ...(compose.rotation !== undefined ? { rotation: compose.rotation } : {}),
    },
  })
}

/** Same paint the overlay canvas uses for a text-preset insert. */
export function paintTextPresetInsert(
  insert: CompositionInsert,
  frameWidth: number,
): InsertStyle | undefined {
  if (!isTextPresetId(insert.preset)) return undefined
  let painted = textPresetToInsertStyle(getTextPreset(insert.preset), frameWidth, {
    x: insert.x ?? DEFAULT_TEXT_X,
    y: insert.y ?? DEFAULT_TEXT_Y,
    fontSize: insert.fontSize,
    rotation: insert.rotation,
  })
  if (insert.styleRef?.overrides) painted = deepMerge(painted, insert.styleRef.overrides)
  return painted
}

export function textPresetToComposeStyle(preset: TextPreset, frameWidth = 1080): ComposeInsertStyle {
  const fontFamily = (parseFontId(fontIdFromFamily(preset.font.family)) ?? "inter") as FontId
  const weight = preset.font.weight
  const fontWeight = (
    weight >= 800 ? 800 : weight >= 700 ? 700 : weight >= 600 ? 600 : weight >= 500 ? 500 : 400
  ) as FontWeight
  const strokeWidth = preset.stroke ? Math.round(preset.stroke.widthRatio * frameWidth) : 0
  const box = preset.box
  const bgColor =
    box && box.mode !== "none" && box.mode !== "highlight-line" ? box.color : null
  return {
    fontFamily,
    fontWeight,
    uppercase: preset.transform === "uppercase",
    color: preset.color,
    bgColor,
    strokeWidth,
    strokeColor: preset.stroke?.color ?? "#000000",
    shadow: (preset.shadows?.length ?? 0) > 0 ? "hard" : "none",
    opacity: 1,
    rotation: preset.rotate ?? 0,
  }
}
