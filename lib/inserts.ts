import type { ComboBeat } from "./combos/schema.ts"
import { COMBO_TEMPLATES } from "./combos/catalog.ts"
import { instantiateCombo } from "./combos/instantiate.ts"
import { resolveBeatTime } from "./combos/resolve.ts"
import type {
  InsertType,
  InsertAnchor,
  AnimPresetId,
  CompositionInsert as Insert,
} from "./composition.ts"
import {
  DEFAULT_FONT_ID,
  DEFAULT_MAX_WIDTH_PCT,
  DEFAULT_STICKER_SCALE,
  DEFAULT_STICKER_X,
  DEFAULT_STICKER_Y,
  DEFAULT_TEXT_X,
  DEFAULT_TEXT_Y,
  TEXT_INSERT_TYPE,
  STICKER_INSERT_TYPE,
  CAPTION_INSERT_TYPE,
  insertKind,
  type StickerSourceKind,
} from "./composition.ts"
import { getElementPreset } from "./elements/catalog.ts"
import { offsetDuplicatePercents } from "./canvas/keys.ts"
import {
  applyTextPreset,
  DEFAULT_TEXT_PRESET_ID,
  NEW_TEXT_FONT_SIZE,
} from "./text-presets/index.ts"

export type {
  InsertType,
  InsertAnchor,
  AnimPresetId,
  CompositionInsert,
  Composition,
} from "./composition.ts"
export type { CompositionInsert as Insert } from "./composition.ts"
export type InsertPosition = InsertAnchor
export { DEFAULT_FONT_ID } from "./composition.ts"

export type InsertCategory = "marca" | "conversao" | "urgencia" | "prova" | "atencao"

/** How the background video is provided to the composition. */
export type BackgroundSource = "url" | "file"

export interface InsertTypeMeta {
  value: InsertType
  label: string
  category: InsertCategory
  /** semantic token used for the timeline track color */
  colorClass: string
  dotVar: string
  /** whether this element carries editable text */
  hasText: boolean
  /** default text used when the element is created */
  defaultText?: string
  /** whether this element appears in the library grid */
  libraryAddable?: boolean
}

export const INSERT_TYPES: InsertTypeMeta[] = [
  {
    value: "logo-shopee",
    label: "Logo Shopee",
    category: "marca",
    colorClass: "bg-track-shopee",
    dotVar: "var(--track-shopee)",
    hasText: true,
    defaultText: "Shopee",
  },
  {
    value: "selo-frete",
    label: "Selo Frete Grátis",
    category: "marca",
    colorClass: "bg-track-frete",
    dotVar: "var(--track-frete)",
    hasText: true,
    defaultText: "FRETE GRÁTIS",
  },
  {
    value: "alerta-desconto",
    label: "Alerta de Desconto",
    category: "urgencia",
    colorClass: "bg-track-desconto",
    dotVar: "var(--track-desconto)",
    hasText: true,
    defaultText: "50% OFF",
  },
  {
    value: "preco-riscado",
    label: "Preço de/por",
    category: "conversao",
    colorClass: "bg-track-preco",
    dotVar: "var(--track-preco)",
    hasText: true,
    defaultText: "de R$ 99 · por R$ 49",
  },
  {
    value: "cupom",
    label: "Cupom com código",
    category: "conversao",
    colorClass: "bg-track-cupom",
    dotVar: "var(--track-cupom)",
    hasText: true,
    defaultText: "CUPOM10",
  },
  {
    value: "contador",
    label: "Contador Regressivo",
    category: "urgencia",
    colorClass: "bg-track-contador",
    dotVar: "var(--track-contador)",
    hasText: true,
    defaultText: "00:10:00",
  },
  {
    value: "barra-estoque",
    label: "Barra de Estoque",
    category: "urgencia",
    colorClass: "bg-track-estoque",
    dotVar: "var(--track-estoque)",
    hasText: true,
    defaultText: "Restam 3",
  },
  {
    value: "estrelas",
    label: "Avaliação (estrelas)",
    category: "prova",
    colorClass: "bg-track-estrelas",
    dotVar: "var(--track-estrelas)",
    hasText: true,
    defaultText: "4,9 · 2mil",
  },
  {
    value: "seta",
    label: "Seta link aqui 👇",
    category: "atencao",
    colorClass: "bg-track-seta",
    dotVar: "var(--track-seta)",
    hasText: true,
    defaultText: "link aqui 👇",
  },
  {
    value: "tarja-frete",
    label: "Tarja de Frete",
    category: "conversao",
    colorClass: "bg-track-frete",
    dotVar: "var(--track-frete)",
    hasText: true,
    defaultText: "FRETE GRÁTIS",
  },
  {
    value: "seta-mao",
    label: "Seta à mão",
    category: "atencao",
    colorClass: "bg-track-seta",
    dotVar: "var(--track-seta)",
    hasText: false,
  },
  {
    value: "circulo-destaque",
    label: "Círculo de destaque",
    category: "atencao",
    colorClass: "bg-track-desconto",
    dotVar: "var(--track-desconto)",
    hasText: false,
  },
  {
    value: "bubble-comentario",
    label: "Comentário TikTok",
    category: "prova",
    colorClass: "bg-track-texto",
    dotVar: "var(--track-texto)",
    hasText: true,
    defaultText: "@loja isso funciona",
  },
  {
    value: "divisor-antes-depois",
    label: "Divisor antes/depois",
    category: "prova",
    colorClass: "bg-track-preco",
    dotVar: "var(--track-preco)",
    hasText: true,
    defaultText: "ANTES  DEPOIS",
  },
  {
    value: "passo",
    label: "Passo 1 de 3",
    category: "atencao",
    colorClass: "bg-track-contador",
    dotVar: "var(--track-contador)",
    hasText: true,
    defaultText: "1 de 3",
  },
  {
    value: "tarja-espera",
    label: "Espera até o final",
    category: "urgencia",
    colorClass: "bg-track-desconto",
    dotVar: "var(--track-desconto)",
    hasText: true,
    defaultText: "espera até o final",
  },
  {
    value: "texto-livre",
    label: "Texto livre",
    category: "atencao",
    colorClass: "bg-track-texto",
    dotVar: "var(--track-texto)",
    hasText: true,
    defaultText: "NOVO",
  },
  {
    value: "sticker-png",
    label: "Insert PNG",
    category: "atencao",
    colorClass: "bg-track-sticker",
    dotVar: "var(--track-sticker)",
    hasText: false,
    libraryAddable: false,
  },
  {
    value: "legenda",
    label: "Legenda",
    category: "atencao",
    colorClass: "bg-track-desconto",
    dotVar: "var(--track-desconto)",
    hasText: true,
    libraryAddable: false,
  },
]

export const ADDABLE_ELEMENT_TYPES = ["estrelas", "bubble-comentario", "texto-livre"] as const
export type AddableElementType = (typeof ADDABLE_ELEMENT_TYPES)[number]

export function isAddableElementType(type: string): type is AddableElementType {
  return (ADDABLE_ELEMENT_TYPES as readonly string[]).includes(type)
}

/** Types shown in + Elemento and Biblioteca → Elementos. */
export function pickerInsertTypes(): InsertTypeMeta[] {
  return INSERT_TYPES.filter((item) => isAddableElementType(item.value))
}

export const INSERT_TYPE_MAP: Record<InsertType, InsertTypeMeta> =
  Object.fromEntries(INSERT_TYPES.map((t) => [t.value, t])) as Record<
    InsertType,
    InsertTypeMeta
  >

export const CATEGORY_LABELS: Record<InsertCategory, string> = {
  marca: "Marca",
  conversao: "Conversão",
  urgencia: "Urgência",
  prova: "Prova social",
  atencao: "Atenção",
}

/* ------------------------------------------------------------------ */
/* Animation presets                                                   */
/* ------------------------------------------------------------------ */

export interface AnimPreset {
  id: string
  label: string
  /** CSS animation-name registered in globals.css (empty = no animation) */
  keyframe: string
}

export const ANIM_PRESETS: AnimPreset[] = [
  { id: "none", label: "Nenhuma", keyframe: "" },
  { id: "pop", label: "Pop", keyframe: "ins-pop" },
  { id: "slide-up", label: "Slide up", keyframe: "ins-slide-up" },
  { id: "blur-in", label: "Blur in", keyframe: "ins-blur-in" },
  { id: "typewriter", label: "Typewriter", keyframe: "ins-typewriter" },
  { id: "shake", label: "Shake", keyframe: "ins-shake" },
]

export const ANIM_MAP: Record<string, AnimPreset> = Object.fromEntries(
  ANIM_PRESETS.map((a) => [a.id, a]),
) as Record<string, AnimPreset>

export const DEFAULT_ANIM_IN: AnimPresetId = "pop"
export const DEFAULT_ANIM_OUT: AnimPresetId = "none"

export const POSITION_LABELS: Record<InsertPosition, string> = {
  top: "Topo",
  center: "Centro",
  bottom: "Base",
}

/* ------------------------------------------------------------------ */
/* Retention zones (fixed on the timeline)                             */
/* ------------------------------------------------------------------ */

export interface RetentionZone {
  id: string
  label: string
  /** start in seconds */
  from: number
  /** end in seconds; null means "until the end" */
  to: number | null
  /** end offset from total duration when `to` is null (e.g. last 5s) */
  fromEnd?: number
  color: string
}

export const RETENTION_ZONES: RetentionZone[] = [
  { id: "gancho", label: "Gancho", from: 0, to: 3, color: "var(--track-desconto)" },
  { id: "prova", label: "Prova", from: 3, to: 8, color: "var(--track-frete)" },
  { id: "cta", label: "CTA", from: 0, to: null, fromEnd: 5, color: "var(--brand)" },
]

/** Resolve a zone's [start,end] in seconds given the total duration. */
export function resolveZone(zone: RetentionZone, total: number): [number, number] {
  if (zone.to === null) {
    const start = Math.max(0, total - (zone.fromEnd ?? 5))
    return [start, total]
  }
  return [zone.from, Math.min(zone.to, total)]
}

export type { FontOption } from "./fonts.ts"
export { FONT_OPTIONS, FONT_MAP } from "./fonts.ts"

/* ------------------------------------------------------------------ */
/* Library: templates                                                  */
/* ------------------------------------------------------------------ */

export interface Template {
  id: string
  name: string
  description: string
  /** Etapa principal do combo. Não entra na composição salva. */
  etapa?: "gancho" | "prova" | "cta"
  /** the inserts this template lays down (without ids) */
  inserts: Array<Partial<Insert> & Pick<Insert, "type" | "start" | "duration">>
  beats?: ComboBeat[]
}

export const TEMPLATES: Template[] = COMBO_TEMPLATES.map((combo) => ({
  id: combo.id,
  name: combo.name,
  description: combo.goal,
  beats: combo.beats,
  etapa: combo.beats[0]?.track === "prova" || combo.beats[0]?.track === "cta" ? combo.beats[0].track : "gancho",
  inserts: combo.beats.map((beat) => {
    const time = resolveBeatTime(beat, 0)
    return {
      type: beat.kind === "text" ? TEXT_INSERT_TYPE : (beat.elementId ?? "selo-frete"),
      start: time.start,
      duration: time.duration,
      text: beat.text,
      x: beat.x,
      y: beat.y,
      scale: beat.scale,
      preset: beat.presetId,
      rotation: beat.rotate,
      anchor: "center" as const,
    }
  }),
}))

/** Materialize a template's inserts with fresh ids, scaled to the video duration. */
export function instantiateTemplate(template: Template, videoDuration = 0): Insert[] {
  if (template.beats && template.beats.length > 0) {
    return instantiateCombo(
      {
        schema: "comboTemplate@1",
        id: template.id,
        name: template.name,
        goal: template.description,
        beats: template.beats,
      },
      videoDuration,
    )
  }
  return template.inserts.map((insert) => ({
    ...createInsert(insert.type),
    ...insert,
    ...newInsertId(),
  }))
}

export function appendTemplateToInserts(
  previous: Insert[],
  template: Template,
  videoDuration = 0,
): Insert[] {
  return [...previous, ...instantiateTemplate(template, videoDuration)]
}

export function applyTemplateToInserts(
  previous: Insert[],
  template: Template,
  videoDuration = 0,
): Insert[] {
  const captions = previous.filter((insert) => insertKind(insert) === "caption")
  return [...instantiateTemplate(template, videoDuration), ...captions]
}

export function duplicateInsert(insert: Insert): Insert {
  const next = offsetDuplicatePercents(insert.x ?? 50, insert.y ?? 50)
  return {
    ...insert,
    ...newInsertId(),
    x: next.x,
    y: next.y,
  }
}

function newInsertId(): { id: string } {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
  }
}

/** Shape of the composition handed to the preview and the export compositor. */

export function createInsert(type: InsertType = "logo-shopee"): Insert {
  const meta = INSERT_TYPE_MAP[type]
  if (type === TEXT_INSERT_TYPE) {
    const created: Insert = {
      ...newInsertId(),
      type,
      kind: "text",
      start: 0,
      duration: 3,
      text: meta.defaultText ?? "NOVO",
      animIn: DEFAULT_ANIM_IN,
      animOut: DEFAULT_ANIM_OUT,
      anchor: "center",
      x: DEFAULT_TEXT_X,
      y: DEFAULT_TEXT_Y,
      fontSize: NEW_TEXT_FONT_SIZE,
      preset: DEFAULT_TEXT_PRESET_ID,
      maxWidthPct: DEFAULT_MAX_WIDTH_PCT,
      textAlign: "center",
    }
    return applyTextPreset(created, DEFAULT_TEXT_PRESET_ID)
  }
  if (type === STICKER_INSERT_TYPE) {
    return {
      ...newInsertId(),
      type,
      kind: "sticker",
      start: 0,
      duration: 3,
      animIn: DEFAULT_ANIM_IN,
      animOut: DEFAULT_ANIM_OUT,
      anchor: "bottom",
      x: DEFAULT_STICKER_X,
      y: DEFAULT_STICKER_Y,
      scale: DEFAULT_STICKER_SCALE,
      sourceKind: "upload",
    }
  }
  if (type === CAPTION_INSERT_TYPE) {
    return {
      ...newInsertId(),
      type,
      kind: "caption",
      start: 0,
      duration: 3,
      text: "",
      words: [],
      animIn: "none",
      animOut: "none",
      anchor: "bottom",
    }
  }
  const recipe = getElementPreset(type)
  return {
    ...newInsertId(),
    type,
    start: 0,
    duration: 3,
    text: meta.hasText ? meta.defaultText ?? recipe?.defaultText : undefined,
    animIn: DEFAULT_ANIM_IN,
    animOut: DEFAULT_ANIM_OUT,
    anchor: "top",
    x: recipe?.defaultX ?? 50,
    y: recipe?.defaultY ?? 18,
    scale: recipe?.defaultScale ?? 1,
  }
}

export function createStickerInsert(input: {
  sourceKind: StickerSourceKind
  label: string
  libraryId?: string
  fileId?: string
}): Insert {
  return {
    ...createInsert(STICKER_INSERT_TYPE),
    sourceKind: input.sourceKind,
    label: input.label,
    ...(input.libraryId ? { libraryId: input.libraryId } : {}),
    ...(input.fileId ? { fileId: input.fileId } : {}),
  }
}

export function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const m = Math.floor(clamped / 60)
  const s = Math.floor(clamped % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

/* ------------------------------------------------------------------ */
/* Batch / A-B variations                                              */
/* ------------------------------------------------------------------ */

export interface BatchAxes {
  hooks: string[]
  fonts: string[]
  positions: InsertPosition[]
}

export interface Variation {
  index: number
  fileName: string
  hook: string
  fontId: string
  fontLabel: string
  position: InsertPosition
}

const DIACRITICS = /[\u0300-\u036f]/g

/** slugify a string for use in file names */
export function slug(input: string): string {
  return input
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24)
}

/**
 * Build the cartesian product of the axes into named variations.
 * File name pattern: <base>_v<NN>_<hook>_<font>_<pos>.mp4
 */
export function buildVariations(
  baseName: string,
  axes: BatchAxes,
  ext = "mp4",
): Variation[] {
  const base = slug(baseName) || "video"
  const hooks = axes.hooks.length ? axes.hooks : [""]
  const fonts = axes.fonts.length ? axes.fonts : [DEFAULT_FONT_ID]
  const positions = axes.positions.length ? axes.positions : ["top"]

  const out: Variation[] = []
  let index = 0
  for (const hook of hooks) {
    for (const fontId of fonts) {
      for (const position of positions) {
        index += 1
        const font = FONT_MAP[fontId]
        const parts = [
          base,
          `v${String(index).padStart(2, "0")}`,
          slug(hook) || "sem-gancho",
          fontId,
          position,
        ]
        out.push({
          index,
          fileName: `${parts.join("_")}.${ext}`,
          hook,
          fontId,
          fontLabel: font?.label ?? fontId,
          position,
        })
      }
    }
  }
  return out
}
