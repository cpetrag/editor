import impactoJson from "./presets/impacto.json" with { type: "json" }
import contornoTiktokJson from "./presets/contorno-tiktok.json" with { type: "json" }
import pilulaPretaJson from "./presets/pilula-preta.json" with { type: "json" }
import marcadorJson from "./presets/marcador.json" with { type: "json" }
import neonJson from "./presets/neon.json" with { type: "json" }
import etiquetaPrecoJson from "./presets/etiqueta-preco.json" with { type: "json" }
import manuscritoJson from "./presets/manuscrito.json" with { type: "json" }
import maquinaJson from "./presets/maquina.json" with { type: "json" }
import blocoJson from "./presets/bloco.json" with { type: "json" }
import apoioJson from "./presets/apoio.json" with { type: "json" }

import { assertTextPreset, type TextPreset, type TextPresetGroup } from "./schema.ts"

export const TEXT_PRESET_IDS = [
  "impacto",
  "contorno-tiktok",
  "pilula-preta",
  "marcador",
  "neon",
  "etiqueta-preco",
  "manuscrito",
  "maquina",
  "bloco",
  "apoio",
] as const

export type TextPresetId = (typeof TEXT_PRESET_IDS)[number]

export const DEFAULT_TEXT_PRESET_ID: TextPresetId = "impacto"
export const MIGRATED_TEXT_PRESET_ID: TextPresetId = "contorno-tiktok"
/** Tamanho padrão de um insert de texto novo (0.0889 × 1080). Parses antigos sem fontSize continuam em 56. */
export const NEW_TEXT_FONT_SIZE = 96

export const TEXT_PRESETS: TextPreset[] = [
  impactoJson,
  contornoTiktokJson,
  pilulaPretaJson,
  marcadorJson,
  neonJson,
  etiquetaPrecoJson,
  manuscritoJson,
  maquinaJson,
  blocoJson,
  apoioJson,
].map((raw) => assertTextPreset(raw))

const BY_ID = new Map(TEXT_PRESETS.map((preset) => [preset.id, preset]))

export function isTextPresetId(id: string | undefined): id is TextPresetId {
  return typeof id === "string" && BY_ID.has(id)
}

export function getTextPreset(id: string): TextPreset {
  const preset = BY_ID.get(id)
  if (!preset) throw new Error(`preset de texto desconhecido: ${id}`)
  return preset
}

export function textPresetsInGroup(group: TextPresetGroup): TextPreset[] {
  return TEXT_PRESETS.filter((preset) => preset.group === group)
}

export const TEXT_PRESET_GROUP_LABELS: Record<TextPresetGroup, string> = {
  impacto: "Impacto",
  destaque: "Destaque",
  apoio: "Apoio",
}
