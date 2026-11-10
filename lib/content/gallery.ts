import type { CompositionInsert } from "../composition.ts"
import { retentionZones, type RetentionCuts } from "../insert-ops.ts"
import { createInsert } from "../inserts.ts"
import { applyEnterRecipe, applyExitRecipe, PACKS } from "../motion/catalog.ts"
import { selectPack } from "../motion/select.ts"
import { listOfferPresets, type OfferPresetMeta } from "../style/offer-styles.ts"
import { getPresetStyle } from "../style/presets.ts"
import type { Animation } from "../style/types.ts"
import { applyContentRecipe } from "./recipes.ts"
import { CONTENT_PRESETS, contentPresetById, type ContentNiche, type ContentPreset, type ContentSlot } from "./presets.ts"
import { presetUsesPrice } from "../shopee/format.ts"
import { shapeQuoteInsert } from "../shopee/quote-fit.ts"
import type { ShopeeInsertSource } from "../shopee/types.ts"
import { fillVars, type ProductData, type ProductField } from "./runs.ts"

export const MOMENT_PACK: Record<ContentSlot, string> = {
  gancho: "estouro",
  prova: "flutuar",
  oferta: "preco",
  cta: "cta-seta",
}

export const FIELD_LABEL: Record<ProductField, string> = {
  produto: "Produto",
  preco: "Preço",
  preco_de: "Preço de",
  desconto: "Desconto",
  cupom: "Cupom",
  nota: "Nota",
  vendidos: "Vendidos",
  tamanhos: "Tamanhos",
  qtd: "Quantidade",
}

const READY_DURATION = 3
const STILL_PACK = "parado"

export function formatClockTenths(seconds: number): string {
  const safe = Math.max(0, seconds)
  const totalTenths = Math.round(safe * 10)
  const minutes = Math.floor(totalTenths / 600)
  const rest = totalTenths - minutes * 600
  const whole = Math.floor(rest / 10)
  const tenth = rest - whole * 10
  return `${minutes}:${String(whole).padStart(2, "0")},${tenth}`
}

/** Tira `*` e `~~`. O texto da timeline e do cabeçalho usa isto. */
export function stripMarks(text: string): string {
  return text
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\\([*~])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function fitReadyWindow(
  start: number,
  duration: number,
  videoDuration: number,
  fps = 30,
): { start: number; duration: number } {
  const frame = 1 / (fps > 0 ? fps : 30)
  const tenth = (value: number) => Math.floor(Math.max(0, value) * 10) / 10
  const length = duration > 0 ? duration : READY_DURATION
  if (!(videoDuration > 0)) return { start: tenth(start), duration: length }
  const nextStart = tenth(Math.min(Math.max(0, start), videoDuration))
  const remaining = videoDuration - nextStart
  if (remaining + frame < 1) {
    const fitted = Math.min(1.5, videoDuration)
    const backed = tenth(Math.max(0, videoDuration - fitted))
    const span = tenth(videoDuration - backed)
    return { start: backed, duration: span > 0 ? span : fitted }
  }
  if (nextStart + length <= videoDuration + frame) return { start: nextStart, duration: length }
  const cut = tenth(remaining)
  return { start: nextStart, duration: cut > 0 ? cut : remaining }
}

export function markerAtTime(
  time: number,
  duration: number,
  cuts?: RetentionCuts | null,
): { slot: ContentSlot; from: number; to: number } {
  const zones = retentionZones(Math.max(duration, 0), cuts)
  const zone =
    zones.find((item, index) => time >= item.from && (index === zones.length - 1 ? time <= item.to : time < item.to)) ??
    zones[zones.length - 1]
  const slot: ContentSlot = zone?.id === "gancho" || zone?.id === "cta" ? zone.id : "prova"
  return { slot, from: zone?.from ?? 0, to: zone?.to ?? duration }
}

export function galleryRecipes(input: {
  niche: ContentNiche
  slot: ContentSlot | "todos"
  query: string
  productData?: ProductData
  pricing?: "off" | "on"
}): ContentPreset[] {
  const query = input.query.trim().toLowerCase()
  const hidePrice = input.pricing === "off"
  const styles = new Map(listOfferPresets().map((preset) => [preset.id, preset.label.toLowerCase()]))
  const rows = CONTENT_PRESETS.map((preset, index) => ({ preset, index })).filter(({ preset }) => {
    if (hidePrice && presetUsesPrice(preset.text)) return false
    if (input.slot !== "todos" && preset.slot !== input.slot) return false
    if (input.niche !== "shopee" && preset.niche !== input.niche && preset.niche !== "shopee") return false
    if (!query) return true
    const plain = stripMarks(fillVars(preset.text, input.productData).text).toLowerCase()
    return plain.includes(query) || (styles.get(preset.style) ?? preset.style).includes(query)
  })
  rows.sort((a, b) => {
    const missingA = fillVars(a.preset.text, input.productData).empty.length
    const missingB = fillVars(b.preset.text, input.productData).empty.length
    if (missingA !== missingB) return missingA - missingB
    const nicheA = a.preset.niche === input.niche ? 0 : 1
    const nicheB = b.preset.niche === input.niche ? 0 : 1
    if (nicheA !== nicheB) return nicheA - nicheB
    return a.index - b.index
  })
  return rows.map((row) => row.preset)
}

export function galleryStyles(slot: ContentSlot | "todos"): OfferPresetMeta[] {
  const all = listOfferPresets()
  if (slot === "todos") return all
  const match = all.filter((preset) => preset.slots.includes(slot))
  return [...match, ...all.filter((preset) => !preset.slots.includes(slot))]
}

export function momentY(slot: ContentSlot): number {
  if (slot === "gancho") return 22
  if (slot === "cta") return 78
  if (slot === "oferta") return 60
  return 64
}

export function styleOnlyText(styleId: string): string {
  if (styleId === "numero-gigante") return "*-{desconto}%*"
  if (getPresetStyle(styleId).text.priceLayout) return "~~{preco_de}~~ *{preco}*"
  return "Seu texto *aqui*"
}

/** O que a miniatura pinta. Número gigante mostra 44 quando o desconto está vazio. */
export function styleOnlyPreview(styleId: string, data?: ProductData): string {
  if (styleId === "numero-gigante" && !(data?.desconto ?? "").trim()) return "*-44%*"
  return styleOnlyText(styleId)
}

export function missingFieldLabels(text: string, data: ProductData | undefined): string[] {
  return fillVars(text, data).empty.map((field) => FIELD_LABEL[field].toLowerCase())
}

export function priceGapCount(
  recipes: ContentPreset[],
  data: ProductData | undefined,
  pricing: "off" | "on" = "on",
): number {
  if (pricing !== "on") return 0
  return recipes.filter((preset) => missingFieldLabels(preset.text, data).includes("preço")).length
}

export type ReadySpec = {
  text: string
  styleId: string
  packId: string
  y: number
  contentId?: string
  source?: ShopeeInsertSource
  role?: "gancho" | "prova" | "cta"
}

export function buildReadyInsert(
  spec: ReadySpec,
  playhead: number,
  videoDuration: number,
  fps = 30,
): CompositionInsert {
  const timing = fitReadyWindow(playhead, READY_DURATION, videoDuration, fps)
  const created = createInsert("texto-livre")
  const recipe = spec.contentId ? contentPresetById(spec.contentId) : undefined
  const styled = recipe ? applyContentRecipe(created, recipe) : paintLoose(created, spec)
  const ready: CompositionInsert = {
    ...styled,
    text: spec.text,
    y: spec.y,
    x: typeof styled.x === "number" ? styled.x : 50,
    start: timing.start,
    duration: timing.duration,
    ...(spec.role ? { role: spec.role } : {}),
    ...(spec.source ? { source: spec.source } : {}),
  }
  return ready.text.includes("\n") ? shapeQuoteInsert(ready) : ready
}

function paintLoose(insert: CompositionInsert, spec: ReadySpec): CompositionInsert {
  const painted = getPresetStyle(spec.styleId)
  const animation = spec.packId === STILL_PACK ? stillAnimation(painted.animation) : selectPack(painted.animation, spec.packId)
  return {
    ...insert,
    text: spec.text,
    y: spec.y,
    fontSize: painted.text.fontSize,
    fontFamily: painted.text.fontFamily,
    styleRef: {
      presetId: spec.styleId,
      overrides: {
        animation,
        text: { y: spec.y, fontSize: painted.text.fontSize },
      },
    },
  }
}

export function stillAnimation(base: Animation): Animation {
  return {
    ...base,
    packId: STILL_PACK,
    unit: "bloco",
    emphasis: [],
    loop: { type: "nenhum", amplitude: 0, speed: 0, recipeId: "nenhum" },
    enter: {
      from: { opacity: 0 },
      durationInFrames: 4,
      delayInFrames: 0,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 0,
    },
    exit: {
      to: { opacity: 0 },
      durationInFrames: 4,
      easing: "linear",
      staggerInFrames: 0,
    },
  }
}

function styleIdOf(insert: CompositionInsert): string {
  return insert.styleRef?.presetId || "legado"
}

function carriedText(insert: CompositionInsert, fontSize: number) {
  const previous = insert.styleRef?.overrides.text
  return {
    y: insert.y,
    fontSize,
    ...(previous?.color ? { color: previous.color } : {}),
    ...(previous?.stroke ? { stroke: previous.stroke } : {}),
    ...(previous?.background ? { background: previous.background } : {}),
  }
}

/** Troca o estilo e conserva texto, tempo, posição e o pacote. */
export function insertWithStyle(insert: CompositionInsert, presetId: string): CompositionInsert {
  const previousBase = getPresetStyle(styleIdOf(insert)).text.fontSize || insert.fontSize || 72
  const ratio = previousBase > 0 ? (insert.fontSize ?? previousBase) / previousBase : 1
  const painted = getPresetStyle(presetId)
  const fontSize = Math.round(painted.text.fontSize * ratio)
  const packId = insert.styleRef?.overrides.animation?.packId
  const animation =
    packId === STILL_PACK
      ? stillAnimation(painted.animation)
      : typeof packId === "string" && packId
        ? selectPack(painted.animation, packId)
        : painted.animation
  return {
    ...insert,
    fontSize,
    fontFamily: painted.text.fontFamily,
    styleRef: {
      presetId,
      overrides: {
        animation,
        text: carriedText(insert, fontSize),
      },
    },
  }
}

export function insertWithPack(insert: CompositionInsert, packId: string): CompositionInsert {
  const painted = getPresetStyle(styleIdOf(insert))
  const animation = packId === STILL_PACK ? stillAnimation(painted.animation) : selectPack(painted.animation, packId)
  return {
    ...insert,
    styleRef: {
      presetId: styleIdOf(insert),
      overrides: {
        ...insert.styleRef?.overrides,
        animation,
      },
    },
  }
}

export const INSERT_SIZE_PERCENT_MIN = 30
export const INSERT_SIZE_PERCENT_MAX = 400

export function sizePercentOf(insert: CompositionInsert): number {
  if (typeof insert.scale === "number" && insert.scale > 0) {
    return Math.max(
      INSERT_SIZE_PERCENT_MIN,
      Math.min(INSERT_SIZE_PERCENT_MAX, Math.round(insert.scale * 100)),
    )
  }
  const base = getPresetStyle(styleIdOf(insert)).text.fontSize
  const current = insert.fontSize ?? base
  if (!(base > 0)) return 100
  return Math.max(
    INSERT_SIZE_PERCENT_MIN,
    Math.min(INSERT_SIZE_PERCENT_MAX, Math.round((current / base) * 100)),
  )
}

export function insertWithSize(insert: CompositionInsert, percent: number): CompositionInsert {
  const base = getPresetStyle(styleIdOf(insert)).text.fontSize || 72
  const clamped = Math.max(INSERT_SIZE_PERCENT_MIN, Math.min(INSERT_SIZE_PERCENT_MAX, percent))
  const scale = clamped / 100
  const fontSize = Math.round(base * scale)
  const text = { ...insert.styleRef?.overrides.text }
  delete text.fontSize
  return {
    ...insert,
    scale,
    fontSize,
    styleRef: {
      presetId: styleIdOf(insert),
      overrides: {
        ...insert.styleRef?.overrides,
        text,
      },
    },
  }
}

export function insertWithColor(insert: CompositionInsert, color: string | null): CompositionInsert {
  const text = { ...insert.styleRef?.overrides.text }
  if (color) text.color = color
  else delete text.color
  return {
    ...insert,
    styleRef: {
      presetId: styleIdOf(insert),
      overrides: { ...insert.styleRef?.overrides, text },
    },
  }
}

export function strokeEnabled(insert: CompositionInsert): boolean {
  const override = insert.styleRef?.overrides.text?.stroke?.enabled
  if (typeof override === "boolean") return override
  return getPresetStyle(styleIdOf(insert)).text.stroke.enabled
}

export function backgroundEnabled(insert: CompositionInsert): boolean {
  const override = insert.styleRef?.overrides.text?.background?.enabled
  if (typeof override === "boolean") return override
  const base = getPresetStyle(styleIdOf(insert)).text
  return base.background.enabled || Boolean(base.highlightBar)
}

export function insertWithStroke(insert: CompositionInsert, enabled: boolean): CompositionInsert {
  const base = getPresetStyle(styleIdOf(insert)).text.stroke
  return {
    ...insert,
    styleRef: {
      presetId: styleIdOf(insert),
      overrides: {
        ...insert.styleRef?.overrides,
        text: {
          ...insert.styleRef?.overrides.text,
          stroke: {
            enabled,
            width: base.width || 8,
            color: base.color || "slot:ink",
          },
        },
      },
    },
  }
}

export function insertWithBackground(insert: CompositionInsert, enabled: boolean): CompositionInsert {
  const base = getPresetStyle(styleIdOf(insert)).text.background
  return {
    ...insert,
    styleRef: {
      presetId: styleIdOf(insert),
      overrides: {
        ...insert.styleRef?.overrides,
        text: {
          ...insert.styleRef?.overrides.text,
          background: {
            enabled,
            color: base.color || "slot:primary",
            opacity: base.opacity || 100,
            paddingX: base.paddingX,
            paddingY: base.paddingY,
            radius: base.radius,
            mode: base.mode,
          },
        },
      },
    },
  }
}

export function insertWithEdge(
  insert: CompositionInsert,
  edge: "enter" | "exit",
  recipeId: string | null,
): CompositionInsert {
  const painted = getPresetStyle(styleIdOf(insert))
  const packId = insert.styleRef?.overrides.animation?.packId
  let animation: Animation =
    packId === STILL_PACK
      ? stillAnimation(painted.animation)
      : typeof packId === "string" && packId
        ? selectPack(painted.animation, packId)
        : painted.animation
  const enterId = edge === "enter" ? recipeId : insert.styleRef?.overrides.animation?.enter?.recipeId
  const exitId = edge === "exit" ? recipeId : insert.styleRef?.overrides.animation?.exit?.recipeId
  if (enterId && enterId !== animation.enter.recipeId) {
    animation = { ...applyEnterRecipe(animation, enterId), packId: animation.packId }
  }
  if (exitId && exitId !== animation.exit.recipeId) {
    animation = { ...applyExitRecipe(animation, exitId), packId: animation.packId }
  }
  return {
    ...insert,
    styleRef: {
      presetId: styleIdOf(insert),
      overrides: { ...insert.styleRef?.overrides, animation },
    },
  }
}

export function wrapMarkup(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  mark: "*" | "~~",
): { text: string; start: number; end: number } | null {
  let start = selectionStart
  let end = selectionEnd
  if (start === end) {
    const left = value.slice(0, start).search(/\S+$/)
    const right = value.slice(start).search(/\s|$/)
    start = left < 0 ? start : left
    end = end + (right < 0 ? 0 : right)
  }
  if (start === end) return null
  const width = mark.length
  if (value.slice(start - width, start) === mark && value.slice(end, end + width) === mark) {
    return {
      text: value.slice(0, start - width) + value.slice(start, end) + value.slice(end + width),
      start: start - width,
      end: end - width,
    }
  }
  const inner = value.slice(start, end)
  if (inner.startsWith(mark) && inner.endsWith(mark) && inner.length > width * 2) {
    return { text: value.slice(0, start) + inner.slice(width, -width) + value.slice(end), start, end: end - width * 2 }
  }
  return {
    text: value.slice(0, start) + mark + inner + mark + value.slice(end),
    start: start + width,
    end: end + width,
  }
}

export function insertToken(value: string, cursor: number, token: string): { text: string; cursor: number } {
  const at = Math.max(0, Math.min(value.length, cursor))
  return { text: value.slice(0, at) + token + value.slice(at), cursor: at + token.length }
}

export function packLabel(packId: string | undefined): string {
  if (!packId || packId === STILL_PACK) return "Parado"
  return PACKS.find((pack) => pack.id === packId)?.label ?? packId
}

export function thumbGridMetrics(
  gridWidth: number,
  mode: "prontos" | "estilos",
): { columns: number; gap: number; cardWidth: number; scale: number; maxTextWidth: number } {
  const narrow = gridWidth > 0 && gridWidth < 280
  const columns = mode === "estilos" ? (narrow ? 2 : 3) : narrow ? 1 : 2
  const gap = mode === "estilos" ? 6 : 10
  const cardWidth = gridWidth > 0 ? (gridWidth - gap * (columns - 1)) / columns : 0
  const scale = cardWidth > 0 ? (cardWidth / 1080) * (mode === "estilos" ? 1.6 : 1.45) : 0
  return { columns, gap, cardWidth, scale, maxTextWidth: cardWidth * 0.9 }
}

export function insertsPastEnd(
  inserts: CompositionInsert[],
  end: number,
  fps = 30,
): CompositionInsert[] {
  if (!(end > 0)) return []
  return inserts.filter(
    (insert) => insert.kind !== "caption" && passesVideoEnd(insert.start, insert.duration, end, fps),
  )
}

export function passesVideoEnd(start: number, duration: number, videoDuration: number, fps = 30): boolean {
  if (!(videoDuration > 0)) return false
  return start + duration > videoDuration + 1 / (fps > 0 ? fps : 30)
}
