export const COMBO_TEMPLATE_SCHEMA = "comboTemplate@1" as const

export const COMBO_TRACKS = ["gancho", "prova", "cta"] as const
export type ComboTrack = (typeof COMBO_TRACKS)[number]

export const COMBO_BEAT_KINDS = ["text", "element"] as const
export type ComboBeatKind = (typeof COMBO_BEAT_KINDS)[number]

export const COMBO_ELEMENT_IDS = [
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
] as const
export type ComboElementId = (typeof COMBO_ELEMENT_IDS)[number]

export type ComboBeat = {
  track: ComboTrack
  atPct: number
  durPct: number
  kind: ComboBeatKind
  presetId?: string
  elementId?: ComboElementId
  text?: string
  x: number
  y: number
  scale: number
  rotate?: number
}

export type ComboTemplate = {
  schema: typeof COMBO_TEMPLATE_SCHEMA
  id: string
  name: string
  goal: string
  beats: ComboBeat[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function fail(path: string, detail: string): never {
  throw new Error(`combo inválido em ${path}: ${detail}`)
}

function readString(raw: Record<string, unknown>, key: string, path: string): string {
  const value = raw[key]
  if (typeof value !== "string" || !value.trim()) fail(`${path}.${key}`, "string não vazia obrigatória")
  return value.trim()
}

function readUnit(raw: Record<string, unknown>, key: string, path: string): number {
  const value = raw[key]
  if (!isFiniteNumber(value)) fail(`${path}.${key}`, "número finito obrigatório")
  if (value < 0 || value > 1) fail(`${path}.${key}`, "deve estar em 0..1")
  return value
}

function readPct(raw: Record<string, unknown>, key: string, path: string): number {
  const value = raw[key]
  if (!isFiniteNumber(value)) fail(`${path}.${key}`, "número finito obrigatório")
  if (value < 0 || value > 100) fail(`${path}.${key}`, "deve estar em 0..100")
  return value
}

function readBeat(raw: unknown, path: string): ComboBeat {
  if (!isRecord(raw)) fail(path, "objeto obrigatório")
  const track = raw.track
  if (typeof track !== "string" || !COMBO_TRACKS.includes(track as ComboTrack)) {
    fail(`${path}.track`, `faixa inválida: ${String(track)}`)
  }
  const kind = raw.kind
  if (typeof kind !== "string" || !COMBO_BEAT_KINDS.includes(kind as ComboBeatKind)) {
    fail(`${path}.kind`, `kind inválido: ${String(kind)}`)
  }
  const beat: ComboBeat = {
    track: track as ComboTrack,
    atPct: readUnit(raw, "atPct", path),
    durPct: readUnit(raw, "durPct", path),
    kind: kind as ComboBeatKind,
    x: readPct(raw, "x", path),
    y: readPct(raw, "y", path),
    scale: (() => {
      const value = raw.scale
      if (!isFiniteNumber(value) || value <= 0) fail(`${path}.scale`, "scale deve ser > 0")
      return value
    })(),
  }
  if (raw.rotate !== undefined) {
    if (!isFiniteNumber(raw.rotate)) fail(`${path}.rotate`, "número finito obrigatório")
    beat.rotate = raw.rotate
  }
  if (raw.text !== undefined) {
    if (typeof raw.text !== "string") fail(`${path}.text`, "string obrigatória")
    beat.text = raw.text
  }
  if (kind === "text") {
    if (typeof raw.presetId !== "string" || !raw.presetId.trim()) {
      fail(`${path}.presetId`, "preset de texto obrigatório")
    }
    beat.presetId = raw.presetId.trim()
  } else {
    const elementId = raw.elementId
    if (typeof elementId !== "string" || !COMBO_ELEMENT_IDS.includes(elementId as ComboElementId)) {
      fail(`${path}.elementId`, `elemento inválido: ${String(elementId)}`)
    }
    beat.elementId = elementId as ComboElementId
  }
  return beat
}

export function isComboElementId(value: string): value is ComboElementId {
  return (COMBO_ELEMENT_IDS as readonly string[]).includes(value)
}

export function isComboTemplate(raw: unknown): raw is ComboTemplate {
  try {
    assertComboTemplate(raw)
    return true
  } catch {
    return false
  }
}

export function assertComboTemplate(raw: unknown): ComboTemplate {
  if (!isRecord(raw)) fail("", "objeto obrigatório")
  if (raw.schema !== COMBO_TEMPLATE_SCHEMA) fail("schema", `esperado ${COMBO_TEMPLATE_SCHEMA}`)
  const id = readString(raw, "id", "")
  const name = readString(raw, "name", "")
  const goal = readString(raw, "goal", "")
  if (!Array.isArray(raw.beats) || raw.beats.length === 0) fail("beats", "pelo menos um beat")
  const beats = raw.beats.map((beat, index) => readBeat(beat, `beats[${index}]`))
  return { schema: COMBO_TEMPLATE_SCHEMA, id, name, goal, beats }
}
