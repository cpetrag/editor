import {
  clampFontWeight,
  parseCssColor,
  parseFontId,
  parseInsertStyle,
  type FontId,
  type FontWeight,
  type InsertStyle,
} from "./compose/insert-style.ts"
import {
  parseStyleRef,
  styleRefFromLegacy,
  DEFAULT_CTA_STYLE_REF,
  type StyleRef,
  type TrackId,
  type UserPreset,
} from "./style/index.ts"
import { migrateInsertTransform, parseInsertTransform, type InsertTransform } from "./insert-transform.ts"
import {
  isIdentitySourceTransform,
  parseSourceTransform,
  serializeSourceTransform,
  type SourceTransform,
} from "./source-transform.ts"
import { clampSourceTrim, parseSourceTrim, resolveTrimWindow, type SourceTrim } from "./source-trim.ts"
import {
  clampSourceCuts,
  parseSourceCuts,
  serializeSourceCuts,
  type SourceCut,
} from "./source-segments.ts"
import {
  isBrandKitId,
  isCustomBrandKitId,
  parseBrandColors,
  parsePaletteOverride,
  type BrandColors,
} from "./brand/kits.ts"
import type { ContentNiche } from "./content/presets.ts"
import type { ProductData } from "./content/runs.ts"
import { parseStoredShopee } from "./shopee/stored.ts"
import type { ShopeeInsertSource, ShopeeProduct } from "./shopee/types.ts"
import { parseCaptionPrefs, type CaptionPrefs } from "./caption-prefs.ts"
import { parseCustomPresets } from "./style/user-presets.ts"
import { getPresetStyle, LEGADO_PRESET_ID } from "./style/presets.ts"
import { reconcileInsertStyle } from "./style/resolve-insert-style.ts"
import { migrateTextPresetId } from "./text-presets/migrate.ts"
import {
  clampAbsoluteCaptionWords,
  toAbsoluteCaptionWords,
} from "./caption-time.ts"
import { clampTrack } from "./audio/range.ts"
import { isIdentityPlayback, parsePlayback, type SourcePlayback } from "./video/playback.ts"
import { activeVoiceEnd, editorDuration, restoreVoiceClampedToVideo } from "./video/duration.ts"
import {
  AUDIO_VOLUME_MAX,
  MAX_AUDIO_TRACKS,
  MAX_VOICE_TRACKS,
  defaultCompositionAudio,
  isAudioKind,
  type AudioTrack,
  type CompositionAudio,
} from "./audio/types.ts"

export const COMPOSITION_VERSION = 9 as const
export const COMPOSITION_VERSION_V8 = 8 as const
export const COMPOSITION_VERSION_V7 = 7 as const
export const LEGACY_COMPOSITION_VERSION = 1 as const
export const COMPOSITION_VERSION_V2 = 2 as const
export const PREVIOUS_COMPOSITION_VERSION = 3 as const
export const COMPOSITION_VERSION_V4 = 4 as const
export const COMPOSITION_VERSION_V5 = 5 as const
export const COMPOSITION_VERSION_V6 = 6 as const
export const MIN_DURATION = 0.5
export const DEFAULT_FPS = 30
export const DEFAULT_WIDTH = 1080
export const DEFAULT_HEIGHT = 1920
export const DEFAULT_OUTPUT_WIDTH = 1080
export const DEFAULT_OUTPUT_HEIGHT = 1920
export const DEFAULT_OUTPUT_FPS = 30
export const DEFAULT_VIDEO_BITRATE = 8_000_000
export const OUTPUT_720_WIDTH = 720
export const OUTPUT_720_HEIGHT = 1280
export const OUTPUT_720_BITRATE = 5_000_000
export const OUTPUT_SOURCE_BITRATE = 4_000_000
export const DEFAULT_FONT_ID = "geist"
export const DEFAULT_BRAND_PRIMARY = "#EE4D2D"
export const DEFAULT_BRAND_LOGO =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#EE4D2D"/><path fill="#fff" d="M18 26h28v26H18z"/><path fill="none" stroke="#fff" stroke-width="4" d="M24 26a8 8 0 0 1 16 0"/></svg>`,
  )
export const PLACEHOLDER_DURATION = 15

export type InsertKind = "chip" | "text" | "sticker" | "caption"
export type CaptionPreset = "viral" | "limpo"
export type OverlayTextAlign = "left" | "center" | "right"
export type StickerSourceKind = "library" | "upload" | "paste"

export type InsertType =
  | "logo-shopee"
  | "selo-frete"
  | "alerta-desconto"
  | "preco-riscado"
  | "cupom"
  | "contador"
  | "barra-estoque"
  | "estrelas"
  | "seta"
  | "tarja-frete"
  | "seta-mao"
  | "circulo-destaque"
  | "bubble-comentario"
  | "divisor-antes-depois"
  | "passo"
  | "tarja-espera"
  | "texto-livre"
  | "sticker-png"
  | "review-media"
  | "legenda"

export type InsertAnchor = "top" | "center" | "bottom"
export type AnimPresetId =
  | "none"
  | "pop"
  | "slide-up"
  | "blur-in"
  | "typewriter"
  | "shake"

export const TEXT_INSERT_TYPE = "texto-livre" as const
export const STICKER_INSERT_TYPE = "sticker-png" as const
export const REVIEW_MEDIA_TYPE = "review-media" as const
export const CAPTION_INSERT_TYPE = "legenda" as const
export const MAX_STICKERS = 20
export const DEFAULT_TEXT_PRESET = "bold-outline"
export const DEFAULT_TEXT_FONT_SIZE = 56
export const DEFAULT_TEXT_X = 50
export const DEFAULT_TEXT_Y = 35
export const DEFAULT_CAPTION_X = 50
export const DEFAULT_CAPTION_Y = 72
export const DEFAULT_CAPTION_FONT_SIZE = 64
export const DEFAULT_CAPTION_PRESET: CaptionPreset = "viral"
export const DEFAULT_CAPTION_HIGHLIGHT = "#FFE500"
export const DEFAULT_CAPTION_COLOR = "#FFFFFF"
export const DEFAULT_CAPTION_BG = "rgba(0,0,0,0.72)"
export const DEFAULT_CAPTION_STROKE = "#000000"
export const DEFAULT_CAPTION_STROKE_WIDTH = 6
export const DEFAULT_STICKER_X = 50
export const DEFAULT_STICKER_Y = 78
export const DEFAULT_STICKER_SCALE = 0.7
export const DEFAULT_MAX_WIDTH_PCT = 84
export const FONT_SIZE_MIN = 40
export const FONT_SIZE_MAX = 360
export const CHIP_FONT_SIZE_MIN = 12
export const DEFAULT_CHIP_FONT_SIZE = 13
export const SCALE_MIN = 0.2
export const SCALE_MAX = 4
export const DEFAULT_CHIP_SCALE = 1
export const OVERLAY_X_MIN = 0
export const OVERLAY_X_MAX = 100
export const OVERLAY_Y_MIN = 0
export const OVERLAY_Y_MAX = 100
export const TEXT_DRAW_Y_MIN = 5
export const TEXT_DRAW_Y_MAX = 95

export type { FontId, FontWeight, InsertStyle, ShadowPreset } from "./compose/insert-style.ts"
export type { StyleRef, TrackId } from "./style/index.ts"
export type { InsertTransform } from "./insert-transform.ts"
export type { SourceTransform }

export type TrackStyle = {
  styleRef?: StyleRef
}

export interface CaptionWord {
  text: string
  start: number
  end: number
  /** Palavra de venda. Não é override de estilo da linha. */
  emphasis?: boolean
}

export interface CompositionInsert {
  id: string
  type: InsertType
  kind?: InsertKind
  start: number
  duration: number
  text?: string
  words?: CaptionWord[]
  anchor: InsertAnchor
  animIn: AnimPresetId
  animOut: AnimPresetId
  x?: number
  y?: number
  fontSize?: number
  preset?: string
  fontFamily?: string
  rotation?: number
  maxWidthPct?: number
  textAlign?: OverlayTextAlign
  role?: "gancho" | "prova" | "cta"
  contentId?: string
  source?: ShopeeInsertSource
  reviewKind?: "image" | "video"
  assetJobId?: string
  scale?: number
  fillColor?: string
  accentColor?: string
  label?: string
  sourceKind?: StickerSourceKind
  libraryId?: string
  fileId?: string
  style?: InsertStyle
  styleRef?: StyleRef
  /** Cores deste insert por cima da paleta do projeto. Slots ausentes seguem o projeto. */
  paletteOverride?: Partial<BrandColors>
  transform?: InsertTransform
  /** Vínculo com a locução. O offset guarda o deslocamento individual. */
  captionSource?: { kind: "voice"; trackId: string; offset: number }
  /** Estilo próprio, só quando o usuário pede. Ausente = estilo global. */
  captionOwnStyle?: boolean
}

export interface CompositionSource {
  duration: number
  fps: number
  width: number
  height: number
  fileName: string
  fileId?: string
  remoteUrl?: string
  canonicalUrl?: string
  provider?: string
  author?: string
  title?: string
  codec?: string
  watermarked?: boolean
  transform?: SourceTransform
  trim?: SourceTrim
  /** Divisões em trechos com zoom próprio; `transform` vale para o trecho inicial. */
  cuts?: SourceCut[]
  /** Velocidade, preenchimento e o que define a duração de saída. Ausente = v8. */
  playback?: SourcePlayback
}

export interface CompositionBrand {
  fontId: string
  primary: string
  logo: string
}

export type OutputQualityId = "1080" | "720" | "source"

export interface CompositionOutput {
  width: number
  height: number
  fps: number
  videoBitrate: number
  /** Duração de saída já resolvida, em segundos. A carga não espera metadata. */
  duration?: number
}

export interface CompositionBatch {
  hooks: string[]
  fonts: string[]
  positions: InsertAnchor[]
  baseName: string
}

export interface CaptionStyle {
  x: number
  y: number
  fontSize: number
  maxWidthPct: number
  fontFamily: FontId
  fontWeight: FontWeight
  color: string
  highlightColor: string
  bgColor: string
  strokeColor: string
  strokeWidth: number
  rotation: number
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  x: DEFAULT_CAPTION_X,
  y: DEFAULT_CAPTION_Y,
  fontSize: DEFAULT_CAPTION_FONT_SIZE,
  maxWidthPct: DEFAULT_MAX_WIDTH_PCT,
  fontFamily: "geist",
  fontWeight: 800,
  color: DEFAULT_CAPTION_COLOR,
  highlightColor: DEFAULT_CAPTION_HIGHLIGHT,
  bgColor: DEFAULT_CAPTION_BG,
  strokeColor: DEFAULT_CAPTION_STROKE,
  strokeWidth: DEFAULT_CAPTION_STROKE_WIDTH,
  rotation: 0,
}

export function mergeCaptionStylePatch(
  style: CaptionStyle,
  patch: Partial<CaptionStyle>,
): CaptionStyle {
  const next = { ...style, ...patch }
  next.x = clamp(roundTenths(next.x), OVERLAY_X_MIN, OVERLAY_X_MAX)
  next.y = clamp(roundTenths(next.y), OVERLAY_Y_MIN, OVERLAY_Y_MAX)
  next.fontSize = Math.round(clamp(next.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX))
  next.maxWidthPct = clamp(next.maxWidthPct, 20, 100)
  next.fontFamily = parseFontId(next.fontFamily) ?? DEFAULT_CAPTION_STYLE.fontFamily
  next.fontWeight = clampFontWeight(next.fontFamily, next.fontWeight)
  next.strokeWidth = Math.round(clamp(next.strokeWidth, 0, 12))
  next.color = parseCssColor(next.color) ?? DEFAULT_CAPTION_COLOR
  next.highlightColor = parseCssColor(next.highlightColor) ?? DEFAULT_CAPTION_HIGHLIGHT
  next.bgColor = parseCssColor(next.bgColor) ?? DEFAULT_CAPTION_BG
  next.strokeColor = parseCssColor(next.strokeColor) ?? DEFAULT_CAPTION_STROKE
  next.rotation = Number.isFinite(next.rotation) ? next.rotation : 0
  return next
}

export function captionInsertForLayout(
  insert: CompositionInsert,
  style: CaptionStyle,
): CompositionInsert {
  if (insertKind(insert) !== "caption") return insert
  return {
    ...insert,
    x: style.x,
    y: style.y,
    fontSize: style.fontSize,
    maxWidthPct: style.maxWidthPct,
    style: {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      uppercase: false,
      color: style.color,
      bgColor: style.bgColor,
      strokeWidth: style.strokeWidth,
      strokeColor: style.strokeColor,
      shadow: "none",
      opacity: 1,
      rotation: style.rotation,
    },
  }
}

export interface Composition {
  version: typeof COMPOSITION_VERSION
  source: CompositionSource
  brand: CompositionBrand
  inserts: CompositionInsert[]
  batch: CompositionBatch
  output: CompositionOutput
  captionPreset: CaptionPreset
  captionStyle: CaptionStyle
  captionPrefs?: CaptionPrefs
  styleRef?: StyleRef
  tracks?: Partial<Record<TrackId, TrackStyle>>
  customPresets?: Record<string, UserPreset>
  watermarkEnabled?: boolean
  retention?: { ganchoEnd: number; ctaStart: number }
  productData?: ProductData
  pricing: "off" | "on"
  shopee?: ShopeeProduct
  niche?: ContentNiche
  nicheManual?: boolean
  brandKitId?: string
  /** Cores usadas no preview e no export. Não mudam se a paleta da biblioteca for editada depois. */
  brandColors?: BrandColors
  kitManual?: boolean
  projectSeed?: string
  audio: CompositionAudio
}

const INSERT_TYPES: readonly InsertType[] = [
  "logo-shopee",
  "selo-frete",
  "alerta-desconto",
  "preco-riscado",
  "cupom",
  "contador",
  "barra-estoque",
  "estrelas",
  "seta",
  "tarja-frete",
  "seta-mao",
  "circulo-destaque",
  "bubble-comentario",
  "divisor-antes-depois",
  "passo",
  "tarja-espera",
  "texto-livre",
  "sticker-png",
  "review-media",
  "legenda",
]

export const CHIP_INSERT_TYPES: readonly InsertType[] = [
  "logo-shopee",
  "selo-frete",
  "alerta-desconto",
  "preco-riscado",
  "cupom",
  "contador",
  "barra-estoque",
  "estrelas",
  "seta",
  "tarja-frete",
  "seta-mao",
  "circulo-destaque",
  "bubble-comentario",
  "divisor-antes-depois",
  "passo",
  "tarja-espera",
]

const ANIM_IDS: readonly AnimPresetId[] = [
  "none",
  "pop",
  "slide-up",
  "blur-in",
  "typewriter",
  "shake",
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isInsertType(value: unknown): value is InsertType {
  return typeof value === "string" && INSERT_TYPES.includes(value as InsertType)
}

function isAnim(value: unknown): value is AnimPresetId {
  return typeof value === "string" && ANIM_IDS.includes(value as AnimPresetId)
}

function isAnchor(value: unknown): value is InsertAnchor {
  return value === "top" || value === "center" || value === "bottom"
}

function isKind(value: unknown): value is InsertKind {
  return value === "chip" || value === "text" || value === "sticker" || value === "caption"
}

function isTextAlign(value: unknown): value is OverlayTextAlign {
  return value === "left" || value === "center" || value === "right"
}

function isSourceKind(value: unknown): value is StickerSourceKind {
  return value === "library" || value === "upload" || value === "paste"
}

export function insertKind(insert: Pick<CompositionInsert, "kind" | "type">): InsertKind {
  if (isKind(insert.kind)) return insert.kind
  if (insert.type === TEXT_INSERT_TYPE) return "text"
  if (insert.type === STICKER_INSERT_TYPE || insert.type === REVIEW_MEDIA_TYPE) return "sticker"
  if (insert.type === CAPTION_INSERT_TYPE) return "caption"
  return "chip"
}

export function isChipInsert(insert: Pick<CompositionInsert, "kind" | "type">): boolean {
  return insertKind(insert) === "chip"
}

export function insertHasFontSize(
  insert: Pick<CompositionInsert, "kind" | "type" | "text">,
): boolean {
  const kind = insertKind(insert)
  if (kind === "caption" || kind === "text") return true
  if (kind !== "chip") return false
  if (insert.type === "logo-shopee") return false
  return Boolean(insert.text?.trim())
}

export function scaleRangeLabel(): string {
  return `Escala ${String(SCALE_MIN).replace(".", ",")}–${SCALE_MAX}`
}

function clampScale(value: number): number {
  return Math.round(clamp(value, SCALE_MIN, SCALE_MAX) * 1000) / 1000
}

function clampChipFontSize(value: number): number {
  return Math.round(clamp(value, CHIP_FONT_SIZE_MIN, FONT_SIZE_MAX))
}

function resolvedKind(type: InsertType, rawKind: unknown): InsertKind | null {
  const kind = isKind(rawKind)
    ? rawKind
    : type === TEXT_INSERT_TYPE
      ? "text"
    : type === STICKER_INSERT_TYPE || type === REVIEW_MEDIA_TYPE
      ? "sticker"
      : type === CAPTION_INSERT_TYPE
        ? "caption"
        : "chip"
  if (kind === "text" && type !== TEXT_INSERT_TYPE) return null
  if (kind === "sticker" && type !== STICKER_INSERT_TYPE && type !== REVIEW_MEDIA_TYPE) return null
  if (kind === "caption" && type !== CAPTION_INSERT_TYPE) return null
  if (
    kind === "chip" &&
    (type === TEXT_INSERT_TYPE || type === STICKER_INSERT_TYPE || type === REVIEW_MEDIA_TYPE || type === CAPTION_INSERT_TYPE)
  ) {
    return null
  }
  return kind
}

function asStoredString(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value.startsWith("blob:")) return undefined
  return value
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundTenths(value: number): number {
  return Math.round(value * 10) / 10
}

/** 30 fps: um décimo (passo do arraste) cai em quadro cheio e 1/30 s também sobrevive. */
function roundToFrame(value: number): number {
  return Math.round(value * 30) / 30
}

export type ClampField = "start" | "duration" | "both"

function clampCaptionWords(
  words: CaptionWord[],
  insertStart: number,
  insertDuration: number,
): CaptionWord[] {
  return clampAbsoluteCaptionWords(
    toAbsoluteCaptionWords(words, insertStart, insertDuration),
    insertStart,
    insertDuration,
  )
}

export function clampInsert(
  insert: CompositionInsert,
  videoDuration: number,
  field: ClampField = "both",
): CompositionInsert {
  const withCaptionWords = (result: CompositionInsert): CompositionInsert => {
    if (insertKind(result) !== "caption" || !result.words?.length) return result
    return { ...result, words: clampCaptionWords(result.words, result.start, result.duration) }
  }

  if (!(videoDuration > 0)) {
    return withCaptionWords({
      ...insert,
      start: Math.max(0, roundToFrame(insert.start)),
      duration: Math.max(MIN_DURATION, roundToFrame(insert.duration)),
    })
  }

  if (field === "duration") {
    const start = Math.max(0, insert.start)
    const maxDuration = Math.max(MIN_DURATION, videoDuration - start)
    let duration = roundTenths(clamp(insert.duration, MIN_DURATION, maxDuration))
    if (start + duration > videoDuration + 1e-9) {
      duration = Math.max(MIN_DURATION, Math.floor(maxDuration * 10 + 1e-8) / 10)
    }
    return withCaptionWords({ ...insert, start, duration })
  }

  let duration = insert.duration
  if (duration > videoDuration) {
    duration = videoDuration
  }
  duration = Math.max(MIN_DURATION, roundToFrame(duration))
  const maxStart = Math.max(0, videoDuration - duration)
  const start = roundToFrame(clamp(insert.start, 0, maxStart))
  return withCaptionWords({ ...insert, start, duration })
}

export function mergeInsertPatch(
  insert: CompositionInsert,
  patch: Partial<CompositionInsert>,
): CompositionInsert {
  const next: CompositionInsert = { ...insert, ...patch }
  const kind = insertKind(next)
  if (kind === "text" || kind === "caption" || kind === "sticker" || kind === "chip") {
    if (typeof next.x === "number") {
      next.x = clamp(roundTenths(next.x), OVERLAY_X_MIN, OVERLAY_X_MAX)
    }
    if (typeof next.y === "number") {
      next.y = clamp(roundTenths(next.y), OVERLAY_Y_MIN, OVERLAY_Y_MAX)
    }
  }
  if ((kind === "text" || kind === "caption") && typeof next.fontSize === "number") {
    next.fontSize = Math.round(clamp(next.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX))
  }
  if (kind === "chip" && typeof next.fontSize === "number") {
    next.fontSize = clampChipFontSize(next.fontSize)
  }
  if ((kind === "sticker" || kind === "chip") && typeof next.scale === "number") {
    next.scale = clampScale(next.scale)
  }
  if ((kind === "text" || kind === "caption" || kind === "chip") && typeof next.maxWidthPct === "number") {
    next.maxWidthPct = clamp(next.maxWidthPct, 20, 100)
  }
  return next
}

function clampCompositionAudio(audio: CompositionAudio | undefined, duration: number): CompositionAudio {
  const source = audio ?? defaultCompositionAudio()
  const limit = duration > 0 ? duration : 0
  const tracks: AudioTrack[] = []
  let voices = 0
  for (const track of source.tracks) {
    if (tracks.length >= MAX_AUDIO_TRACKS) break
    if (track.kind === "voice") {
      if (voices >= MAX_VOICE_TRACKS) continue
      voices += 1
    }
    tracks.push(clampTrack(track, limit))
  }
  const volume = asNumber(source.original?.volume)
  const amount = asNumber(source.ducking?.amount)
  const fade = asNumber(source.ducking?.fade)
  return {
    original: {
      volume: clamp(volume ?? 1, 0, AUDIO_VOLUME_MAX),
      muted: source.original?.muted === true,
    },
    tracks,
    ducking: {
      enabled: source.ducking?.enabled !== false,
      amount: clamp(amount ?? 0.65, 0, 1),
      fade: Math.max(0, fade ?? 0.25),
    },
  }
}

export function clampComposition(composition: Composition): Composition {
  const computed = editorDuration(composition.source, composition.audio)
  const saved = composition.output?.duration ?? 0
  const voice =
    composition.source.playback?.fit === "audio" ? activeVoiceEnd(composition.audio) : 0
  const outputDuration = Math.max(computed, saved, voice)
  const duration = outputDuration > 0 ? outputDuration : composition.source.duration
  const audio = clampCompositionAudio(composition.audio, duration > 0 ? duration : 0)
  const audioSame = JSON.stringify(composition.audio) === JSON.stringify(audio)
  const nextAudio = audioSame ? composition.audio : audio
  if (!(duration > 0)) return audioSame ? composition : { ...composition, audio: nextAudio }
  return {
    ...composition,
    audio: nextAudio,
    source: clampSourceCutsOf(clampSourceWithTrim(composition.source)),
    inserts: isIdentityPlayback(composition.source.playback)
      ? clampInsertsToTrimEnd(
          composition.inserts.map((insert) => clampInsert(insert, composition.source.duration)),
          composition.source,
        )
      : composition.inserts.map((insert) => clampInsert(insert, duration)),
  }
}

/** b.6 — o insert termina no máximo na Saída (source.trim.end). */
function clampInsertsToTrimEnd(inserts: CompositionInsert[], source: CompositionSource): CompositionInsert[] {
  const end = resolveTrimWindow(source).end
  if (!(end > 0)) return inserts
  let changed = false
  const tenthDown = (value: number) => Math.floor(Math.max(0, value) * 10 + 1e-6) / 10
  const next = inserts.map((insert) => {
    if (insert.kind === "caption") return insert
    if (!(insert.start + insert.duration > end + 0.001)) return insert
    changed = true
    if (insert.start >= end - 0.5) {
      const start = tenthDown(Math.max(0, end - 1.5))
      return { ...insert, start, duration: Math.max(0.5, tenthDown(end - start)) }
    }
    return { ...insert, duration: Math.max(0.5, tenthDown(end - insert.start)) }
  })
  return changed ? next : inserts
}

/** Mantém a identidade do objeto quando o corte já está válido (evita re-render). */
function clampSourceWithTrim(source: CompositionSource): CompositionSource {
  if (!source.trim) return source
  const trim = clampSourceTrim(source.trim, source.duration)
  if (trim && trim.start === source.trim.start && trim.end === source.trim.end) return source
  const { trim: _drop, ...rest } = source
  return trim ? { ...rest, trim } : rest
}

function clampSourceCutsOf(source: CompositionSource): CompositionSource {
  if (!source.cuts) return source
  const cuts = clampSourceCuts(source.cuts, source.duration)
  if (cuts === source.cuts) return source
  const { cuts: _drop, ...rest } = source
  return cuts ? { ...rest, cuts } : rest
}

function parseCaptionWords(
  raw: unknown,
  insertStart: number,
  insertDuration: number,
): CaptionWord[] {
  if (!Array.isArray(raw)) return []
  const words: CaptionWord[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    if (typeof item.text !== "string" || !item.text) continue
    const start = asNumber(item.start)
    const end = asNumber(item.end)
    if (start === null || end === null) continue
    if (!(start >= 0)) continue
    if (!(end > start)) continue
    words.push({
      text: item.text,
      start,
      end,
      ...(item.emphasis === true ? { emphasis: true } : {}),
    })
  }
  return clampCaptionWords(words, insertStart, insertDuration)
}

function parseCaptionPreset(raw: unknown): CaptionPreset {
  return raw === "limpo" ? "limpo" : DEFAULT_CAPTION_PRESET
}

function parseCaptionStyle(
  raw: unknown,
  fallback: CaptionStyle = DEFAULT_CAPTION_STYLE,
): CaptionStyle {
  if (!isRecord(raw)) return { ...fallback }
  const patch: Partial<CaptionStyle> = {}
  const x = asNumber(raw.x)
  if (x !== null) patch.x = x
  const y = asNumber(raw.y)
  if (y !== null) patch.y = y
  const fontSize = asNumber(raw.fontSize)
  if (fontSize !== null) patch.fontSize = fontSize
  const maxWidthPct = asNumber(raw.maxWidthPct)
  if (maxWidthPct !== null) patch.maxWidthPct = maxWidthPct
  const fontFamily = parseFontId(raw.fontFamily)
  if (fontFamily) patch.fontFamily = fontFamily
  const fontWeight = asNumber(raw.fontWeight)
  if (fontWeight !== null) patch.fontWeight = fontWeight as FontWeight
  if (typeof raw.color === "string") patch.color = raw.color
  if (typeof raw.highlightColor === "string") patch.highlightColor = raw.highlightColor
  if (typeof raw.bgColor === "string") patch.bgColor = raw.bgColor
  if (typeof raw.strokeColor === "string") patch.strokeColor = raw.strokeColor
  const strokeWidth = asNumber(raw.strokeWidth)
  if (strokeWidth !== null) patch.strokeWidth = strokeWidth
  const rotation = asNumber(raw.rotation)
  if (rotation !== null) patch.rotation = rotation
  return mergeCaptionStylePatch(fallback, patch)
}

function migrateCaptionStyle(input: Record<string, unknown>): CaptionStyle {
  if (isRecord(input.captionStyle)) {
    return parseCaptionStyle(input.captionStyle)
  }
  const rawInserts = Array.isArray(input.inserts) ? input.inserts : []
  const rawCaption = rawInserts.find(
    (item) => isRecord(item) && (item.type === "legenda" || item.kind === "caption"),
  )
  if (!isRecord(rawCaption)) return { ...DEFAULT_CAPTION_STYLE }
  const style = isRecord(rawCaption.style) ? rawCaption.style : {}
  return parseCaptionStyle({
    x: rawCaption.x,
    y: rawCaption.y,
    fontSize: rawCaption.fontSize,
    maxWidthPct: rawCaption.maxWidthPct,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    color: style.color,
    bgColor: style.bgColor === null ? undefined : style.bgColor,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
  })
}

function parseTracks(raw: unknown): Composition["tracks"] | undefined {
  if (!isRecord(raw)) return undefined
  const tracks: NonNullable<Composition["tracks"]> = {}
  for (const id of ["gancho", "prova", "cta"] as const) {
    const entry = raw[id]
    if (!isRecord(entry)) continue
    const styleRef = parseStyleRef(entry.styleRef)
    if (styleRef) tracks[id] = { styleRef }
  }
  return Object.keys(tracks).length ? tracks : undefined
}

function attachStyleRef(
  insert: CompositionInsert,
  raw: Record<string, unknown>,
): CompositionInsert {
  const explicit = parseStyleRef(raw.styleRef)
  const withRef = explicit
    ? { ...insert, styleRef: explicit }
    : insertKind(insert) === "sticker"
      ? insert
      : attachLegacyStyleRef(insert, raw)
  const transform = parseInsertTransform(raw.transform)
  const next = transform ? { ...withRef, transform } : withRef
  return reconcileInsertStyle(next)
}

function attachLegacyStyleRef(
  insert: CompositionInsert,
  raw: Record<string, unknown>,
): CompositionInsert {
  const x = asNumber(raw.x)
  const y = asNumber(raw.y)
  const fontSize = asNumber(raw.fontSize)
  const rotation = asNumber(raw.rotation)
  const migrated = styleRefFromLegacy({
    fontFamily: asStoredString(raw.fontFamily),
    fontSize: fontSize === null ? undefined : fontSize,
    rotation: rotation === null ? undefined : rotation,
    x: x === null ? undefined : x,
    y: y === null ? undefined : y,
    style: insert.style,
  })
  if (!migrated) return insert
  return { ...insert, styleRef: migrated }
}

function parseInsert(raw: unknown): CompositionInsert | null {
  if (!isRecord(raw)) return null
  if (!isInsertType(raw.type)) return null
  const kind = resolvedKind(raw.type, raw.kind)
  if (!kind) return null
  const start = asNumber(raw.start ?? raw.startTime)
  const duration = asNumber(raw.duration)
  if (start === null || duration === null) return null
  const id =
    typeof raw.id === "string" && raw.id
      ? raw.id
      : `insert-${Math.random().toString(36).slice(2)}`
  const anchor = isAnchor(raw.anchor)
    ? raw.anchor
    : isAnchor(raw.position)
      ? raw.position
      : kind === "sticker" || kind === "caption"
        ? "bottom"
        : kind === "text"
          ? "center"
          : "top"
  const style = parseInsertStyle(raw.style)
  const base: CompositionInsert = {
    id,
    type: raw.type,
    start,
    duration,
    ...(typeof raw.text === "string" ? { text: raw.text } : {}),
    anchor,
    animIn: isAnim(raw.animIn) ? raw.animIn : kind === "caption" ? "none" : "pop",
    animOut: isAnim(raw.animOut) ? raw.animOut : "none",
    ...(style ? { style } : {}),
    ...provenanceOf(raw),
  }

  if (kind === "chip") {
    const x = asNumber(raw.x)
    const y = asNumber(raw.y)
    const scale = asNumber(raw.scale)
    const fontSize = asNumber(raw.fontSize)
    const fillColor = parseCssColor(raw.fillColor)
    const accentColor = parseCssColor(raw.accentColor)
    return attachStyleRef(
      {
        ...base,
        ...(x !== null ? { x: clamp(roundTenths(x), OVERLAY_X_MIN, OVERLAY_X_MAX) } : {}),
        ...(y !== null ? { y: clamp(roundTenths(y), OVERLAY_Y_MIN, OVERLAY_Y_MAX) } : {}),
        ...(scale !== null ? { scale: clampScale(scale) } : {}),
        ...(fontSize !== null ? { fontSize: clampChipFontSize(fontSize) } : {}),
        ...(fillColor ? { fillColor } : {}),
        ...(accentColor ? { accentColor } : {}),
        ...(asNumber(raw.maxWidthPct) !== null
          ? { maxWidthPct: clamp(asNumber(raw.maxWidthPct)!, 20, 100) }
          : {}),
      },
      raw,
    )
  }

  if (kind === "caption") {
    return attachStyleRef(
      {
        id,
        type: raw.type,
        start,
        duration,
        kind: "caption",
        text: typeof raw.text === "string" ? raw.text : "",
        words: parseCaptionWords(raw.words, start, duration),
        anchor,
        animIn: "none",
        animOut: "none",
        ...(raw.captionOwnStyle === true ? { captionOwnStyle: true } : {}),
        ...(isRecord(raw.captionSource) &&
        raw.captionSource.kind === "voice" &&
        typeof raw.captionSource.trackId === "string" &&
        asNumber(raw.captionSource.offset) !== null
          ? {
              captionSource: {
                kind: "voice" as const,
                trackId: raw.captionSource.trackId,
                offset: asNumber(raw.captionSource.offset)!,
              },
            }
          : {}),
        ...(asNumber(raw.x) !== null
          ? { x: clamp(roundTenths(asNumber(raw.x)!), OVERLAY_X_MIN, OVERLAY_X_MAX) }
          : {}),
        ...(asNumber(raw.y) !== null
          ? { y: clamp(roundTenths(asNumber(raw.y)!), OVERLAY_Y_MIN, OVERLAY_Y_MAX) }
          : {}),
        ...(asNumber(raw.rotation) !== null ? { rotation: asNumber(raw.rotation)! } : {}),
        ...(asNumber(raw.maxWidthPct) !== null
          ? { maxWidthPct: clamp(asNumber(raw.maxWidthPct)!, 20, 100) }
          : {}),
      },
      raw,
    )
  }

  const x = clamp(
    asNumber(raw.x) ?? (kind === "sticker" ? DEFAULT_STICKER_X : DEFAULT_TEXT_X),
    OVERLAY_X_MIN,
    OVERLAY_X_MAX,
  )
  const y = clamp(
    asNumber(raw.y) ?? (kind === "sticker" ? DEFAULT_STICKER_Y : DEFAULT_TEXT_Y),
    OVERLAY_Y_MIN,
    OVERLAY_Y_MAX,
  )

  if (kind === "text") {
    const fontSize = Math.round(
      clamp(
        asNumber(raw.fontSize) ?? DEFAULT_TEXT_FONT_SIZE,
        FONT_SIZE_MIN,
        FONT_SIZE_MAX,
      ),
    )
    return attachStyleRef(
      {
        ...base,
        kind: "text",
        text: typeof raw.text === "string" ? raw.text : "NOVO",
        x,
        y,
        fontSize,
        preset: migrateTextPresetId(
          typeof raw.preset === "string" && raw.preset ? raw.preset : undefined,
        ),
        maxWidthPct: clamp(asNumber(raw.maxWidthPct) ?? DEFAULT_MAX_WIDTH_PCT, 20, 100),
        textAlign: isTextAlign(raw.textAlign) ? raw.textAlign : "center",
        ...(asStoredString(raw.fontFamily) ? { fontFamily: asStoredString(raw.fontFamily) } : {}),
        ...(asNumber(raw.rotation) !== null ? { rotation: asNumber(raw.rotation)! } : {}),
        ...(asNumber(raw.scale) !== null ? { scale: clampScale(asNumber(raw.scale)!) } : {}),
        ...(raw.role === "gancho" || raw.role === "prova" || raw.role === "cta" ? { role: raw.role } : {}),
        ...(typeof raw.contentId === "string" && raw.contentId ? { contentId: raw.contentId } : {}),
      },
      raw,
    )
  }

  const scale = clampScale(asNumber(raw.scale) ?? DEFAULT_STICKER_SCALE)
  const libraryId = asStoredString(raw.libraryId)
  const fileId = asStoredString(raw.fileId)
  const sourceKind = isSourceKind(raw.sourceKind)
    ? raw.sourceKind
    : libraryId
      ? "library"
      : "upload"
  return attachStyleRef(
    {
      ...base,
      kind: "sticker",
      x,
      y,
      scale,
      sourceKind,
      ...(libraryId ? { libraryId } : {}),
      ...(fileId ? { fileId } : {}),
      ...(typeof raw.label === "string" && raw.label ? { label: raw.label } : {}),
      ...(raw.reviewKind === "image" || raw.reviewKind === "video" ? { reviewKind: raw.reviewKind } : {}),
      ...(typeof raw.assetJobId === "string" && raw.assetJobId ? { assetJobId: raw.assetJobId } : {}),
    },
    raw,
  )
}

function parseSource(raw: unknown): CompositionSource {
  const record = isRecord(raw) ? raw : {}
  const remote =
    typeof record.remoteUrl === "string" && !record.remoteUrl.startsWith("blob:")
      ? record.remoteUrl
      : undefined
  const canonical = asStoredString(record.canonicalUrl)
  const provider = asStoredString(record.provider)
  const author = asStoredString(record.author)
  const title = asStoredString(record.title)
  const codec = asStoredString(record.codec)
  const width = asNumber(record.width) ?? DEFAULT_WIDTH
  const height = asNumber(record.height) ?? DEFAULT_HEIGHT
  const transform = parseSourceTransform(record.transform, width, height)
  const duration = asNumber(record.duration) ?? 0
  const trim = parseSourceTrim(record.trim, duration)
  const cuts = parseSourceCuts(record.cuts, duration, width, height)
  return {
    duration,
    fps: asNumber(record.fps) ?? DEFAULT_FPS,
    width,
    height,
    fileName: typeof record.fileName === "string" ? record.fileName : "",
    ...(typeof record.fileId === "string" ? { fileId: record.fileId } : {}),
    ...(remote ? { remoteUrl: remote } : {}),
    ...(canonical ? { canonicalUrl: canonical } : {}),
    ...(provider ? { provider } : {}),
    ...(author ? { author } : {}),
    ...(title ? { title } : {}),
    ...(codec ? { codec } : {}),
    ...(typeof record.watermarked === "boolean" ? { watermarked: record.watermarked } : {}),
    ...(transform ? { transform } : {}),
    ...(trim ? { trim } : {}),
    ...(cuts ? { cuts } : {}),
    playback: parsePlayback(record.playback),
  }
}

function evenSize(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2)
}

function clampBitrate(value: number): number {
  return Math.round(clamp(value, 1_000_000, 20_000_000))
}

function clampOutputFps(value: number): number {
  return value >= 24 && value <= 60 ? Math.round(value) : DEFAULT_OUTPUT_FPS
}

export function defaultOutput(): CompositionOutput {
  return {
    width: DEFAULT_OUTPUT_WIDTH,
    height: DEFAULT_OUTPUT_HEIGHT,
    fps: DEFAULT_OUTPUT_FPS,
    videoBitrate: DEFAULT_VIDEO_BITRATE,
  }
}

export function outputFromQuality(
  quality: OutputQualityId,
  source: Pick<CompositionSource, "width" | "height" | "fps">,
): CompositionOutput {
  if (quality === "1080") return defaultOutput()
  if (quality === "720") {
    return {
      width: OUTPUT_720_WIDTH,
      height: OUTPUT_720_HEIGHT,
      fps: DEFAULT_OUTPUT_FPS,
      videoBitrate: OUTPUT_720_BITRATE,
    }
  }
  return {
    width: evenSize(Math.min(source.width || DEFAULT_OUTPUT_WIDTH, DEFAULT_OUTPUT_WIDTH)),
    height: evenSize(Math.min(source.height || DEFAULT_OUTPUT_HEIGHT, DEFAULT_OUTPUT_HEIGHT)),
    fps: clampOutputFps(source.fps),
    videoBitrate: OUTPUT_SOURCE_BITRATE,
  }
}

export function qualityFromOutput(
  output: CompositionOutput,
  source: Pick<CompositionSource, "width" | "height">,
): OutputQualityId {
  if (output.width === DEFAULT_OUTPUT_WIDTH && output.height === DEFAULT_OUTPUT_HEIGHT) {
    return "1080"
  }
  if (output.width === OUTPUT_720_WIDTH && output.height === OUTPUT_720_HEIGHT) {
    return "720"
  }
  void source
  return "source"
}

function parseOutput(
  raw: unknown,
  source: CompositionSource,
): CompositionOutput {
  if (!isRecord(raw)) return defaultOutput()
  const width = asNumber(raw.width)
  const height = asNumber(raw.height)
  if (width === null || height === null) return defaultOutput()
  return {
    width: evenSize(clamp(width, 2, DEFAULT_OUTPUT_WIDTH)),
    height: evenSize(clamp(height, 2, DEFAULT_OUTPUT_HEIGHT)),
    fps: clampOutputFps(asNumber(raw.fps) ?? source.fps),
    videoBitrate: clampBitrate(asNumber(raw.videoBitrate) ?? DEFAULT_VIDEO_BITRATE),
    ...(asNumber(raw.duration) !== null && asNumber(raw.duration)! > 0
      ? { duration: asNumber(raw.duration)! }
      : {}),
  }
}

function isSupportedVersion(value: unknown): boolean {
  return (
    value === COMPOSITION_VERSION ||
    value === COMPOSITION_VERSION_V8 ||
    value === COMPOSITION_VERSION_V7 ||
    value === COMPOSITION_VERSION_V6 ||
    value === COMPOSITION_VERSION_V5 ||
    value === COMPOSITION_VERSION_V4 ||
    value === PREVIOUS_COMPOSITION_VERSION ||
    value === COMPOSITION_VERSION_V2 ||
    value === LEGACY_COMPOSITION_VERSION
  )
}

function isContentNicheValue(value: unknown): value is ContentNiche {
  return value === "shopee" || value === "moda" || value === "beleza" || value === "bebe"
}

function isStoredBrandKitId(value: unknown): value is string {
  return typeof value === "string" && (isBrandKitId(value) || isCustomBrandKitId(value))
}

function withPaletteOverride(insert: CompositionInsert, raw: Record<string, unknown>): CompositionInsert {
  const paletteOverride = parsePaletteOverride(raw.paletteOverride)
  return paletteOverride ? { ...insert, paletteOverride } : insert
}

const SOURCE_FIELDS = ["rating", "sold", "quote", "sizes", "colors", "badge", "reviewMedia"] as const

function parseInsertSource(raw: unknown): ShopeeInsertSource | undefined {
  if (!isRecord(raw) || raw.kind !== "shopee" || typeof raw.fetchedAt !== "string") return undefined
  const field = typeof raw.field === "string" && SOURCE_FIELDS.includes(raw.field as (typeof SOURCE_FIELDS)[number])
    ? (raw.field as ShopeeInsertSource["field"])
    : undefined
  return {
    kind: "shopee",
    fetchedAt: raw.fetchedAt,
    ...(field ? { field } : {}),
    ...(typeof raw.reviewId === "string" && raw.reviewId ? { reviewId: raw.reviewId } : {}),
    ...(typeof raw.snapshot === "string" ? { snapshot: raw.snapshot } : {}),
    ...(raw.pasted === true ? { pasted: true } : {}),
  }
}

function provenanceOf(raw: Record<string, unknown>): Pick<CompositionInsert, "source" | "reviewKind" | "assetJobId"> {
  const source = parseInsertSource(raw.source)
  const reviewKind = raw.reviewKind === "image" || raw.reviewKind === "video" ? raw.reviewKind : undefined
  const assetJobId = typeof raw.assetJobId === "string" && raw.assetJobId ? raw.assetJobId : undefined
  return {
    ...(source ? { source } : {}),
    ...(reviewKind ? { reviewKind } : {}),
    ...(assetJobId ? { assetJobId } : {}),
  }
}

function parseProductData(raw: unknown): ProductData | undefined {
  if (!isRecord(raw)) return undefined
  const keys = [
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
  const data: ProductData = {}
  let found = false
  for (const key of keys) {
    const value = raw[key]
    if (typeof value !== "string") continue
    data[key] = value
    found = true
  }
  return found ? data : undefined
}

function parseRetention(raw: unknown): { ganchoEnd: number; ctaStart: number } | undefined {
  if (!isRecord(raw)) return undefined
  const ganchoEnd = asNumber(raw.ganchoEnd)
  const ctaStart = asNumber(raw.ctaStart)
  if (ganchoEnd === null || ctaStart === null) return undefined
  return { ganchoEnd, ctaStart }
}

/**
 * Até a v5 a rotação gravada era o ângulo desenhado. Agora ela é o extra do
 * usuário e a inclinação do preset soma na hora de pintar.
 */
function migrateLayoutRotation(insert: CompositionInsert, version: number): CompositionInsert {
  if (version >= COMPOSITION_VERSION_V6) return insert
  if (insert.kind === "caption" || insert.type === "legenda") return insert
  if (insert.kind !== "text" && insert.type !== "texto-livre") return insert
  const presetId = insert.styleRef?.presetId
  if (!presetId || presetId === LEGADO_PRESET_ID) return insert
  if (typeof insert.rotation !== "number" || !Number.isFinite(insert.rotation)) return insert
  const tilt = getPresetStyle(presetId).text.rotation ?? 0
  if (!tilt) return insert
  const delta = insert.rotation - tilt
  return {
    ...insert,
    rotation: delta,
    transform: insert.transform
      ? { ...insert.transform, rotation: insert.transform.rotation - tilt }
      : insert.transform,
  }
}

export function parseComposition(input: unknown): Composition {
  if (!isRecord(input)) {
    throw new Error("versão de composição inválida")
  }
  if (!isSupportedVersion(input.version)) {
    throw new Error(`versão (version) de composição não suportada: ${String(input.version)}`)
  }
  const brand = isRecord(input.brand) ? input.brand : {}
  const batch = isRecord(input.batch) ? input.batch : {}
  const captionStyle = migrateCaptionStyle(input)
  const storedVersion = typeof input.version === "number" ? input.version : LEGACY_COMPOSITION_VERSION
  const inserts = Array.isArray(input.inserts)
    ? input.inserts
        .map((item) => {
          const insert = parseInsert(item)
          return insert && isRecord(item) ? withPaletteOverride(insert, item) : insert
        })
        .filter((insert): insert is CompositionInsert => insert !== null)
        .map((insert) => migrateLayoutRotation(insert, storedVersion))
        .map((insert) => migrateInsertTransform(insert, captionStyle))
    : []
  const positions = Array.isArray(batch.positions)
    ? batch.positions.filter(isAnchor)
    : (["top"] as InsertAnchor[])
  const fonts = Array.isArray(batch.fonts)
    ? batch.fonts.filter((item): item is string => typeof item === "string")
    : [DEFAULT_FONT_ID]
  const hooks = Array.isArray(batch.hooks)
    ? batch.hooks.filter((item): item is string => typeof item === "string")
    : []

  const source = parseSource(input.source)
  const productData = parseProductData(input.productData)
  const styleRef = parseStyleRef(input.styleRef)
  const tracks = parseTracks(input.tracks)
  const customPresets = parseCustomPresets(input.customPresets)
  const retention = parseRetention(input.retention)
  return clampComposition({
    version: COMPOSITION_VERSION,
    source,
    brand: {
      fontId: typeof brand.fontId === "string" ? brand.fontId : DEFAULT_FONT_ID,
      primary:
        typeof brand.primary === "string" ? brand.primary : DEFAULT_BRAND_PRIMARY,
      logo: typeof brand.logo === "string" ? brand.logo : DEFAULT_BRAND_LOGO,
    },
    inserts,
    batch: {
      hooks,
      fonts: fonts.length ? fonts : [DEFAULT_FONT_ID],
      positions: positions.length ? positions : ["top"],
      baseName: typeof batch.baseName === "string" ? batch.baseName : "",
    },
    output: parseOutput(input.output, source),
    captionPreset: parseCaptionPreset(input.captionPreset),
    captionStyle,
    ...(parseCaptionPrefs(input.captionPrefs) ? { captionPrefs: parseCaptionPrefs(input.captionPrefs) } : {}),
    ...(styleRef ? { styleRef } : {}),
    ...(tracks ? { tracks } : {}),
    ...(customPresets ? { customPresets } : {}),
    ...(input.watermarkEnabled === true ? { watermarkEnabled: true } : {}),
    ...(retention ? { retention } : {}),
    ...(productData ? { productData } : {}),
    pricing: input.pricing === "on" ? "on" : "off",
    ...(parseStoredShopee(input.shopee) ? { shopee: parseStoredShopee(input.shopee)! } : {}),
    ...(isContentNicheValue(input.niche) ? { niche: input.niche } : {}),
    ...(input.nicheManual === true ? { nicheManual: true } : {}),
    ...(isStoredBrandKitId(input.brandKitId) ? { brandKitId: input.brandKitId } : {}),
    ...(parseBrandColors(input.brandColors) ? { brandColors: parseBrandColors(input.brandColors) } : {}),
    ...(input.kitManual === true ? { kitManual: true } : {}),
    ...(typeof input.projectSeed === "string" && input.projectSeed ? { projectSeed: input.projectSeed } : {}),
    audio:
      storedVersion >= COMPOSITION_VERSION_V7
        ? restoreAudioForVersion(parseAudio(input.audio, Number.POSITIVE_INFINITY), storedVersion, source.duration)
        : defaultCompositionAudio(),
  })
}

function restoreAudioForVersion(
  audio: CompositionAudio,
  storedVersion: number,
  sourceDuration: number,
): CompositionAudio {
  if (storedVersion >= COMPOSITION_VERSION) return audio
  const tracks = restoreVoiceClampedToVideo(audio.tracks, sourceDuration)
  return tracks === audio.tracks ? audio : { ...audio, tracks }
}

function parseAudio(raw: unknown, videoDuration: number): CompositionAudio {
  if (!isRecord(raw)) return defaultCompositionAudio()
  const original = isRecord(raw.original) ? raw.original : {}
  const ducking = isRecord(raw.ducking) ? raw.ducking : {}
  const tracks = Array.isArray(raw.tracks)
    ? raw.tracks.flatMap((item) => {
        const track = parseAudioTrack(item)
        return track ? [track] : []
      })
    : []
  return clampCompositionAudio(
    {
      original: {
        volume: asNumber(original.volume) ?? 1,
        muted: original.muted === true,
      },
      tracks,
      ducking: {
        enabled: ducking.enabled !== false,
        amount: asNumber(ducking.amount) ?? 0.65,
        fade: asNumber(ducking.fade) ?? 0.25,
      },
    },
    videoDuration,
  )
}

function parseAudioTrack(raw: unknown): AudioTrack | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== "string" || !raw.id) return null
  if (typeof raw.fileId !== "string" || !raw.fileId) return null
  const duration = asNumber(raw.duration)
  if (duration === null || duration < 0) return null
  return {
    id: raw.id,
    kind: isAudioKind(raw.kind) ? raw.kind : "sfx",
    fileId: raw.fileId,
    fileName: typeof raw.fileName === "string" ? raw.fileName : "audio",
    duration,
    start: asNumber(raw.start) ?? 0,
    trimIn: asNumber(raw.trimIn) ?? 0,
    trimOut: asNumber(raw.trimOut) ?? duration,
    volume: asNumber(raw.volume) ?? 1,
    fadeIn: asNumber(raw.fadeIn) ?? 0,
    fadeOut: asNumber(raw.fadeOut) ?? 0,
    loop: raw.loop === true,
    muted: raw.muted === true,
  }
}

function serializeInsert(insert: CompositionInsert): CompositionInsert {
  const kind = insertKind(insert)
  const base: CompositionInsert = {
    id: insert.id,
    type: insert.type,
    start: insert.start,
    duration: insert.duration,
    ...(insert.text !== undefined ? { text: insert.text } : {}),
    anchor: insert.anchor,
    animIn: insert.animIn,
    animOut: insert.animOut,
    ...(insert.style ? { style: insert.style } : {}),
    ...(insert.styleRef ? { styleRef: insert.styleRef } : {}),
    ...(insert.paletteOverride ? { paletteOverride: insert.paletteOverride } : {}),
    ...(insert.transform ? { transform: insert.transform } : {}),
  }
  if (kind === "chip") {
    return {
      ...base,
      ...(typeof insert.x === "number" ? { x: insert.x } : {}),
      ...(typeof insert.y === "number" ? { y: insert.y } : {}),
      ...(typeof insert.scale === "number" ? { scale: insert.scale } : {}),
      ...(typeof insert.fontSize === "number" ? { fontSize: insert.fontSize } : {}),
      ...(insert.fillColor ? { fillColor: insert.fillColor } : {}),
      ...(insert.accentColor ? { accentColor: insert.accentColor } : {}),
      ...(typeof insert.maxWidthPct === "number" ? { maxWidthPct: insert.maxWidthPct } : {}),
    }
  }
  if (kind === "text") {
    return {
      ...base,
      kind: "text",
      x: insert.x ?? DEFAULT_TEXT_X,
      y: insert.y ?? DEFAULT_TEXT_Y,
      fontSize: insert.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
      preset: insert.preset ?? DEFAULT_TEXT_PRESET,
      maxWidthPct: insert.maxWidthPct ?? DEFAULT_MAX_WIDTH_PCT,
      textAlign: insert.textAlign ?? "center",
      ...(asStoredString(insert.fontFamily) ? { fontFamily: insert.fontFamily } : {}),
      ...(typeof insert.rotation === "number" && Number.isFinite(insert.rotation)
        ? { rotation: insert.rotation }
        : {}),
      ...(typeof insert.scale === "number" && Number.isFinite(insert.scale)
        ? { scale: insert.scale }
        : {}),
      ...(insert.role ? { role: insert.role } : {}),
      ...(insert.contentId ? { contentId: insert.contentId } : {}),
      ...(insert.source ? { source: insert.source } : {}),
    }
  }
  if (kind === "caption") {
    return {
      id: insert.id,
      type: insert.type,
      kind: "caption",
      start: insert.start,
      duration: insert.duration,
      text: insert.text ?? "",
      anchor: insert.anchor,
      animIn: "none",
      animOut: "none",
      words: insert.words ?? [],
      ...(insert.styleRef ? { styleRef: insert.styleRef } : {}),
      ...(insert.transform ? { transform: insert.transform } : {}),
      ...(insert.captionOwnStyle ? { captionOwnStyle: true } : {}),
      ...(insert.captionSource ? { captionSource: insert.captionSource } : {}),
      ...(insert.source ? { source: insert.source } : {}),
    }
  }
  return {
    ...base,
    kind: "sticker",
    x: insert.x ?? DEFAULT_STICKER_X,
    y: insert.y ?? DEFAULT_STICKER_Y,
    scale: insert.scale ?? DEFAULT_STICKER_SCALE,
    sourceKind: insert.sourceKind ?? (insert.libraryId ? "library" : "upload"),
    ...(asStoredString(insert.libraryId) ? { libraryId: insert.libraryId } : {}),
    ...(asStoredString(insert.fileId) ? { fileId: insert.fileId } : {}),
    ...(insert.label ? { label: insert.label } : {}),
    ...(insert.reviewKind ? { reviewKind: insert.reviewKind } : {}),
    ...(insert.assetJobId ? { assetJobId: insert.assetJobId } : {}),
    ...(insert.source ? { source: insert.source } : {}),
  }
}

export function serializeComposition(composition: Composition): string {
  const remoteUrl =
    composition.source.remoteUrl &&
    !composition.source.remoteUrl.startsWith("blob:")
      ? composition.source.remoteUrl
      : undefined
  const payload: Composition = {
    version: COMPOSITION_VERSION,
    source: {
      duration: composition.source.duration,
      fps: composition.source.fps,
      width: composition.source.width,
      height: composition.source.height,
      fileName: composition.source.fileName,
      ...(composition.source.fileId ? { fileId: composition.source.fileId } : {}),
      ...(remoteUrl ? { remoteUrl } : {}),
      ...(asStoredString(composition.source.canonicalUrl)
        ? { canonicalUrl: composition.source.canonicalUrl }
        : {}),
      ...(asStoredString(composition.source.provider)
        ? { provider: composition.source.provider }
        : {}),
      ...(asStoredString(composition.source.author) ? { author: composition.source.author } : {}),
      ...(asStoredString(composition.source.title) ? { title: composition.source.title } : {}),
      ...(asStoredString(composition.source.codec) ? { codec: composition.source.codec } : {}),
      ...(typeof composition.source.watermarked === "boolean"
        ? { watermarked: composition.source.watermarked }
        : {}),
      ...(composition.source.transform &&
      !isIdentitySourceTransform(composition.source.transform)
        ? { transform: serializeSourceTransform(composition.source.transform) }
        : {}),
      ...(composition.source.trim
        ? { trim: { start: composition.source.trim.start, end: composition.source.trim.end } }
        : {}),
      ...(composition.source.cuts && composition.source.cuts.length > 0
        ? { cuts: serializeSourceCuts(composition.source.cuts) }
        : {}),
      ...(composition.source.playback ? { playback: composition.source.playback } : {}),
    },
    brand: { ...composition.brand },
    inserts: composition.inserts.map(serializeInsert),
    batch: {
      hooks: [...composition.batch.hooks],
      fonts: [...composition.batch.fonts],
      positions: [...composition.batch.positions],
      baseName: composition.batch.baseName,
    },
    output: {
      ...composition.output,
      duration: editorDuration(composition.source, composition.audio) || composition.output.duration,
    },
    captionPreset: composition.captionPreset ?? DEFAULT_CAPTION_PRESET,
    captionStyle: composition.captionStyle,
    ...(composition.captionPrefs ? { captionPrefs: composition.captionPrefs } : {}),
    ...(composition.styleRef ? { styleRef: composition.styleRef } : {}),
    ...(composition.tracks ? { tracks: composition.tracks } : {}),
    ...(composition.customPresets ? { customPresets: composition.customPresets } : {}),
    ...(composition.watermarkEnabled === true ? { watermarkEnabled: true } : {}),
    ...(composition.retention ? { retention: composition.retention } : {}),
    ...(composition.productData ? { productData: composition.productData } : {}),
    pricing: composition.pricing === "on" ? "on" : "off",
    ...(composition.shopee ? { shopee: composition.shopee } : {}),
    ...(composition.niche ? { niche: composition.niche } : {}),
    ...(composition.nicheManual ? { nicheManual: true } : {}),
    ...(composition.brandKitId ? { brandKitId: composition.brandKitId } : {}),
    ...(composition.brandColors ? { brandColors: composition.brandColors } : {}),
    ...(composition.kitManual ? { kitManual: true } : {}),
    ...(composition.projectSeed ? { projectSeed: composition.projectSeed } : {}),
    audio: composition.audio ?? defaultCompositionAudio(),
  }
  return JSON.stringify(payload)
}

export function createDefaultComposition(): Composition {
  return {
    version: COMPOSITION_VERSION,
    source: {
      duration: 0,
      fps: DEFAULT_FPS,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      fileName: "",
    },
    brand: { fontId: DEFAULT_FONT_ID, primary: DEFAULT_BRAND_PRIMARY, logo: DEFAULT_BRAND_LOGO },
    inserts: [],
    batch: {
      hooks: [
        "Você não vai acreditar no preço",
        "Corre que acaba hoje",
      ],
      fonts: [DEFAULT_FONT_ID],
      positions: ["top", "center"],
      baseName: "campanha-shopee",
    },
    output: defaultOutput(),
    captionPreset: DEFAULT_CAPTION_PRESET,
    captionStyle: DEFAULT_CAPTION_STYLE,
    tracks: { cta: { styleRef: DEFAULT_CTA_STYLE_REF } },
    pricing: "off",
    audio: defaultCompositionAudio(),
  }
}

export function resolveTimelineDuration(sourceDuration: number): number {
  return sourceDuration > 0 ? sourceDuration : PLACEHOLDER_DURATION
}
