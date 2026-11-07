import type { InsertStyle } from "../style/types.ts"
import { resolveColor, type BrandKit } from "./kits.ts"

function paint(color: string, kit: BrandKit): string {
  return resolveColor(color, kit)
}

/** Troca `slot:*` pelas cores do kit. Hex literal permanece. */
export function resolveStyleColors(style: InsertStyle, kit: BrandKit): InsertStyle {
  const text = style.text
  return {
    ...style,
    text: {
      ...text,
      color: paint(text.color, kit),
      accent: text.accent ? paint(text.accent, kit) : text.accent,
      stroke: { ...text.stroke, color: paint(text.stroke.color, kit) },
      shadows: text.shadows.map((shadow) => ({ ...shadow, color: paint(shadow.color, kit) })),
      background: { ...text.background, color: paint(text.background.color, kit) },
      highlight: {
        ...text.highlight,
        color: paint(text.highlight.color, kit),
        boxColor: text.highlight.boxColor ? paint(text.highlight.boxColor, kit) : text.highlight.boxColor,
      },
      gradient: {
        ...text.gradient,
        from: paint(text.gradient.from, kit),
        to: paint(text.gradient.to, kit),
      },
      outerStroke: text.outerStroke
        ? { ...text.outerStroke, color: paint(text.outerStroke.color, kit) }
        : undefined,
      longShadow: text.longShadow
        ? { ...text.longShadow, color: paint(text.longShadow.color, kit) }
        : undefined,
      highlightBar: text.highlightBar
        ? { ...text.highlightBar, color: paint(text.highlightBar.color, kit) }
        : undefined,
    },
  }
}
