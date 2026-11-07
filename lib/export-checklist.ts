import {
  insertKind,
  type Composition,
  type CompositionInsert,
} from "./composition.ts"
import { approxBox, type PlayBox } from "./compose/hit-test.ts"
import { PLAY_H, PLAY_W } from "./compose/layout.ts"
import { fallbackTextMeasure } from "./compose/layout-text.ts"
import { parseCssColor } from "./compose/insert-style.ts"
import { layoutOverlayInsertForPlay } from "./compose/caption-layout.ts"
import { layoutInserts } from "./insert-layout.ts"
import { INSERT_TYPES } from "./inserts.ts"
import { resolveCaptionInsertStyle } from "./style/caption-map.ts"
import { resolveStyle } from "./style/resolve-style.ts"
import { trackStyleForInsert } from "./style-preset.ts"
import type { StyleLayer, StyleRef } from "./style/types.ts"

export const SHORT_DURATION_LIMIT = 0.8
export const CONTRAST_RATIO_MIN = 3
export const SAFE_TOP_PCT = 0.12
export const SAFE_BOTTOM_PCT = 0.22
export const SAFE_RIGHT_PCT = 0.16

export type ChecklistKind = "text" | "chip" | "sticker" | "caption"

export type Aabb = {
  left: number
  top: number
  right: number
  bottom: number
}

export type ChecklistItem = {
  id: string
  kind: ChecklistKind
  start: number
  duration: number
  label: string
  hasText: boolean
  box: Aabb | null
  fill: string | null
  background: string | null
  stroke: string | null
}

export type ExportWarningCode =
  | "short"
  | "overlap"
  | "collision"
  | "safe-top"
  | "safe-bottom"
  | "safe-right"
  | "contrast-bare"
  | "contrast-low"
  | "empty-var"

export type ExportWarning = {
  id: string
  code: ExportWarningCode
  insertIds: string[]
  title: string
}

const BODY: ReadonlySet<ChecklistKind> = new Set(["text", "chip", "sticker"])

export function playBoxToAabb(box: PlayBox): Aabb {
  return {
    left: box.cx - box.w / 2,
    top: box.cy - box.h / 2,
    right: box.cx + box.w / 2,
    bottom: box.cy + box.h / 2,
  }
}

function isBody(kind: ChecklistKind): boolean {
  return BODY.has(kind)
}

function intervalsOverlap(a: ChecklistItem, b: ChecklistItem): boolean {
  return a.start < b.start + b.duration - 1e-6 && b.start < a.start + a.duration - 1e-6
}

function aabbsOverlap(a: Aabb, b: Aabb): boolean {
  return a.left < b.right - 1e-6 && a.right > b.left + 1e-6 && a.top < b.bottom - 1e-6 && a.bottom > b.top + 1e-6
}

function quote(label: string): string {
  return `“${label}”`
}

function formatSeconds(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",")
}

function channel(value: number): number {
  const srgb = value / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

function rgbFromCss(raw: string): [number, number, number] | null {
  const hex = parseCssColor(raw)
  if (hex && hex.startsWith("#") && (hex.length === 7 || hex.length === 9)) {
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    if ([r, g, b].every((part) => Number.isFinite(part))) return [r, g, b]
  }
  const rgb = raw.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (!rgb) return null
  const r = Number(rgb[1])
  const g = Number(rgb[2])
  const b = Number(rgb[3])
  if (![r, g, b].every((part) => Number.isFinite(part))) return null
  return [r, g, b]
}

function relativeLuminance(raw: string): number | null {
  const rgb = rgbFromCss(raw)
  if (!rgb) return null
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  if (a === null || b === null) return null
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

function insertLabel(insert: CompositionInsert): string {
  const text = insert.text?.trim()
  if (text) {
    return text
      .replace(/\\([*~])/g, "$1")
      .replace(/~~([^~]*)~~/g, "$1")
      .replace(/\*([^*]*)\*/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  }
  return INSERT_TYPES.find((meta) => meta.value === insert.type)?.label ?? "Insert"
}

function contrastAgainst(item: ChecklistItem): string | null {
  if (item.background) return item.background
  if (item.stroke) return item.stroke
  return null
}

export function collectExportWarnings(items: ChecklistItem[]): ExportWarning[] {
  const warnings: ExportWarning[] = []

  for (const item of items) {
    if (isBody(item.kind) && item.duration < SHORT_DURATION_LIMIT - 1e-9) {
      warnings.push({
        id: `short:${item.id}`,
        code: "short",
        insertIds: [item.id],
        title: `Muito curto — ${formatSeconds(item.duration)} s. Abaixo de 0,8 s some no Reels.`,
      })
    }
  }

  for (let i = 0; i < items.length; i += 1) {
    const a = items[i]
    if (!a || !isBody(a.kind)) continue
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j]
      if (!b || !isBody(b.kind)) continue
      if (!intervalsOverlap(a, b)) continue
      warnings.push({
        id: `overlap:${a.id}+${b.id}`,
        code: "overlap",
        insertIds: [a.id, b.id],
        title: `${quote(a.label)} e ${quote(b.label)} coincidem no tempo.`,
      })
    }
  }

  for (let i = 0; i < items.length; i += 1) {
    const a = items[i]
    if (!a?.box) continue
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j]
      if (!b?.box) continue
      const captionPair = a.kind === "caption" && b.kind === "caption"
      if (captionPair) continue
      if (!isBody(a.kind) && !isBody(b.kind)) continue
      if (!intervalsOverlap(a, b) || !aabbsOverlap(a.box, b.box)) continue
      const body = a.kind === "caption" ? b : a
      const other = body === a ? b : a
      const coversCaption = other.kind === "caption"
      warnings.push({
        id: `collision:${a.id}+${b.id}`,
        code: "collision",
        insertIds: [body.id, other.id],
        title: coversCaption
          ? `${quote(body.label)} cobre a legenda.`
          : `${quote(a.label)} e ${quote(b.label)} se sobrepõem no quadro.`,
      })
    }
  }

  const topLimit = PLAY_H * SAFE_TOP_PCT
  const bottomLimit = PLAY_H * (1 - SAFE_BOTTOM_PCT)
  const rightLimit = PLAY_W * (1 - SAFE_RIGHT_PCT)

  for (const item of items) {
    if (!item.box) continue
    if (item.box.top < topLimit) {
      warnings.push({
        id: `safe-top:${item.id}`,
        code: "safe-top",
        insertIds: [item.id],
        title: `${quote(item.label)} entra no topo (capa do Reels).`,
      })
    }
    if (item.kind !== "caption" && item.box.bottom > bottomLimit) {
      warnings.push({
        id: `safe-bottom:${item.id}`,
        code: "safe-bottom",
        insertIds: [item.id],
        title: `${quote(item.label)} entra na faixa de áudio/legenda.`,
      })
    }
    if (item.box.right > rightLimit) {
      warnings.push({
        id: `safe-right:${item.id}`,
        code: "safe-right",
        insertIds: [item.id],
        title: `${quote(item.label)} entra na coluna dos botões.`,
      })
    }
  }

  for (const item of items) {
    if (!item.hasText) continue
    const fill = item.fill
    if (!fill) continue
    const against = contrastAgainst(item)
    if (!against) {
      warnings.push({
        id: `contrast-bare:${item.id}`,
        code: "contrast-bare",
        insertIds: [item.id],
        title: `${quote(item.label)} sem fundo nem contorno — pode sumir no vídeo.`,
      })
      continue
    }
    const ratio = contrastRatio(fill, against)
    if (ratio !== null && ratio < CONTRAST_RATIO_MIN) {
      warnings.push({
        id: `contrast-low:${item.id}`,
        code: "contrast-low",
        insertIds: [item.id],
        title: `${quote(item.label)} tem pouco contraste com o fundo.`,
      })
    }
  }

  return collapseCaptionWarnings(warnings, items)
}

const CAPTION_COLLAPSE_TITLES: Partial<Record<ExportWarningCode, string>> = {
  "safe-right": "As legendas entram na coluna dos botões.",
  "safe-top": "As legendas entram no topo (capa do Reels).",
  "contrast-bare": "As legendas sem fundo nem contorno — pode sumir no vídeo.",
  "contrast-low": "As legendas têm pouco contraste com o fundo.",
}

function collapseCaptionWarnings(
  warnings: ExportWarning[],
  items: ChecklistItem[],
): ExportWarning[] {
  const captionIds = new Set(
    items.filter((item) => item.kind === "caption").map((item) => item.id),
  )
  const groups = new Map<ExportWarningCode, ExportWarning[]>()
  for (const warning of warnings) {
    if (!isCaptionOnlyCollapsible(warning, captionIds)) continue
    const group = groups.get(warning.code) ?? []
    group.push(warning)
    groups.set(warning.code, group)
  }

  const emitted = new Set<ExportWarningCode>()
  const next: ExportWarning[] = []
  for (const warning of warnings) {
    if (!isCaptionOnlyCollapsible(warning, captionIds)) {
      next.push(warning)
      continue
    }
    const group = groups.get(warning.code)
    if (!group || group.length < 2) {
      next.push(warning)
      continue
    }
    if (emitted.has(warning.code)) continue
    emitted.add(warning.code)
    next.push({
      id: `${warning.code}:captions`,
      code: warning.code,
      insertIds: group.flatMap((entry) => entry.insertIds),
      title: CAPTION_COLLAPSE_TITLES[warning.code] ?? warning.title,
    })
  }
  return next
}

function isCaptionOnlyCollapsible(
  warning: ExportWarning,
  captionIds: Set<string>,
): boolean {
  if (!CAPTION_COLLAPSE_TITLES[warning.code]) return false
  if (warning.insertIds.length === 0) return false
  return warning.insertIds.every((id) => captionIds.has(id))
}

function projectLayer(styleRef: StyleRef | undefined): StyleLayer {
  return styleRef ? { styleRef } : {}
}

function paintFromResolved(painted: {
  text: {
    color: string
    background: { enabled: boolean; color: string }
    stroke: { enabled: boolean; width: number; color: string }
  }
}): Pick<ChecklistItem, "fill" | "background" | "stroke"> {
  return {
    fill: painted.text.color,
    background: painted.text.background.enabled ? painted.text.background.color : null,
    stroke:
      painted.text.stroke.enabled && painted.text.stroke.width > 0
        ? painted.text.stroke.color
        : null,
  }
}

export type ChecklistComposition = {
  inserts: CompositionInsert[]
  source: { duration: number }
  captionStyle: Composition["captionStyle"]
  captionPreset?: Composition["captionPreset"]
  tracks?: Composition["tracks"]
  styleRef?: Composition["styleRef"]
  brand: { fontId: string; logo: string }
}

export function checklistItemsFromComposition(composition: ChecklistComposition): ChecklistItem[] {
  const duration = composition.source.duration
  const fontId = composition.brand.fontId
  const project = projectLayer(composition.styleRef)
  const frame = { width: PLAY_W, height: PLAY_H }
  const items: ChecklistItem[] = []

  for (const insert of composition.inserts) {
    const kind = insertKind(insert)
    if (kind !== "text" && kind !== "chip" && kind !== "sticker" && kind !== "caption") continue
    const track = trackStyleForInsert(insert, composition.tracks, duration)
    const sampleTime = insert.start + Math.min(0.05, Math.max(0, insert.duration / 2))
    const chips = kind === "chip"
      ? layoutInserts(
          composition.inserts,
          sampleTime,
          frame,
          fontId,
          composition.brand.logo,
          {
            project,
            tracks: composition.tracks,
            videoDuration: duration,
          },
        )
      : []
    const chip = chips.find((entry) => entry.id === insert.id)
    const playInsert = layoutOverlayInsertForPlay(
      insert,
      composition.captionStyle,
      composition.captionPreset ?? "viral",
      track,
      project,
    )
    const rawBox =
      kind === "chip" && chip
        ? {
            left: chip.x,
            top: chip.y,
            right: chip.x + chip.width,
            bottom: chip.y + chip.height,
          }
        : (() => {
            const play = approxBox(
              playInsert,
              1,
              undefined,
              null,
              fontId,
              fallbackTextMeasure,
            )
            return play ? playBoxToAabb(play) : null
          })()

    let fill: string | null = null
    let background: string | null = null
    let stroke: string | null = null
    if (kind === "caption") {
      const painted = resolveCaptionInsertStyle(
        insert,
        composition.captionStyle,
        composition.captionPreset ?? "viral",
        track,
        project,
      )
      const next = paintFromResolved(painted)
      fill = next.fill
      background = next.background
      stroke = next.stroke
    } else if (kind === "text") {
      const painted = resolveStyle(insert, track, project)
      const next = paintFromResolved(painted)
      fill = next.fill
      background = next.background
      stroke = next.stroke
    } else if (kind === "chip" && chip) {
      fill = chip.paint.color
      background = chip.paint.bgColor
      stroke = chip.paint.strokeWidth > 0 ? chip.paint.strokeColor : null
    }

    const text = insert.text?.trim() ?? ""
    const hasText =
      kind === "sticker" ? false : kind === "chip" ? Boolean(text) : kind === "caption" || kind === "text"

    items.push({
      id: insert.id,
      kind,
      start: insert.start,
      duration: insert.duration,
      label: insertLabel(insert),
      hasText,
      box: rawBox,
      fill,
      background,
      stroke,
    })
  }

  return items
}
