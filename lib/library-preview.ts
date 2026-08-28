import { INSERT_TYPE_MAP, type Template } from "./inserts.ts"
import type { InsertAnchor } from "./composition.ts"
import { resolveBeatTime } from "./combos/resolve.ts"

export function comboDuration(template: Template, videoDuration = 0): number {
  if (template.beats && template.beats.length > 0) {
    return template.beats.reduce((max, beat) => {
      const time = resolveBeatTime(beat, videoDuration)
      return Math.max(max, time.start + time.duration)
    }, 0)
  }
  return template.inserts.reduce(
    (max, insert) => Math.max(max, insert.start + insert.duration),
    0,
  )
}

export function comboOverflowsVideo(template: Template, videoDuration: number): boolean {
  if (template.beats && template.beats.length > 0) return false
  return videoDuration > 0 && comboDuration(template) > videoDuration + 1e-6
}

export function normalizedRange(
  start: number,
  duration: number,
  total: number,
): { leftPct: number; widthPct: number } {
  if (!(total > 0)) return { leftPct: 0, widthPct: 100 }
  return {
    leftPct: (Math.max(0, start) / total) * 100,
    widthPct: (Math.max(0, duration) / total) * 100,
  }
}

export function previewAnchorTop(anchor: InsertAnchor | undefined): number {
  if (anchor === "center") return 50
  if (anchor === "bottom") return 82
  return 14
}

export function comboPreviewMarks(template: Template) {
  const total = comboDuration(template)
  return template.inserts.map((insert) => {
    const meta = INSERT_TYPE_MAP[insert.type]
    const range = normalizedRange(insert.start, insert.duration, total)
    return {
      type: insert.type,
      color: meta.dotVar,
      topPct: previewAnchorTop(insert.anchor),
      ...range,
    }
  })
}
