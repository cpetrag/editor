import { isTextPresetId, MIGRATED_TEXT_PRESET_ID, type TextPresetId } from "./catalog.ts"

const LEGACY_TEXT_PRESET_IDS = new Set([
  "bold-outline",
  "caption-clean",
  "sticker-quero",
  "caption-box",
  "legado",
  "outline",
  "Legado",
  "Outline",
  "",
])

type TextInsertLike = {
  kind?: string
  type?: string
  preset?: string
}

function isTextInsert(insert: TextInsertLike): boolean {
  return insert.kind === "text" || insert.type === "texto-livre"
}

export function isLegacyTextPresetId(id: string | undefined): boolean {
  if (id === undefined) return true
  const trimmed = id.trim()
  if (!trimmed) return true
  if (isTextPresetId(trimmed)) return false
  return LEGACY_TEXT_PRESET_IDS.has(trimmed) || /legado|outline/i.test(trimmed)
}

export function migrateTextPresetId(id: string | undefined): TextPresetId {
  if (id && isTextPresetId(id)) return id
  return MIGRATED_TEXT_PRESET_ID
}

export function migrateTextInsert<T extends TextInsertLike>(insert: T): T {
  if (!isTextInsert(insert)) return insert
  const nextPreset = migrateTextPresetId(insert.preset)
  if (nextPreset === insert.preset) return insert
  return { ...insert, preset: nextPreset }
}

export function migrateTextInserts<T extends TextInsertLike>(inserts: T[]): T[] {
  return inserts.map((insert) => migrateTextInsert(insert))
}
