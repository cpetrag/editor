import { deepMerge } from "./deep-merge.ts"
import {
  LEGADO_STYLE,
  canWritePresetId,
  extraPresetCatalog,
  setExtraPresets,
} from "./presets.ts"
import type { DeepPartial, InsertStyle, PresetGroup, UserPreset } from "./types.ts"

export const USER_PRESET_FILE_VERSION = 1 as const
export { canWritePresetId, extraPresetCatalog, setExtraPresets }

const PRESET_GROUPS: readonly PresetGroup[] = ["legenda", "gancho", "prova", "cta"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPresetGroup(value: unknown): value is PresetGroup {
  return typeof value === "string" && (PRESET_GROUPS as readonly string[]).includes(value)
}

export function allocateUserPresetId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `meu_${raw.replace(/-/g, "").slice(0, 16)}`
}

export function createUserPreset(input: {
  id?: string
  label: string
  group: PresetGroup
  style: InsertStyle | DeepPartial<InsertStyle>
  maxWords?: number
}): UserPreset {
  const id = input.id ?? allocateUserPresetId()
  if (!canWritePresetId(id)) {
    throw new Error("preset de fábrica é somente-leitura")
  }
  const label = input.label.trim()
  if (!label) {
    throw new Error("nome do preset obrigatório")
  }
  return {
    id,
    label,
    group: input.group,
    style: deepMerge(LEGADO_STYLE, input.style),
    ...(typeof input.maxWords === "number" && input.maxWords > 0
      ? { maxWords: input.maxWords }
      : {}),
  }
}

export function serializeUserPresetFile(presets: UserPreset[]): string {
  const payload = {
    version: USER_PRESET_FILE_VERSION,
    presets: presets.filter((preset) => canWritePresetId(preset.id)).map((preset) => ({
      id: preset.id,
      label: preset.label,
      group: preset.group,
      style: preset.style,
      ...(preset.maxWords ? { maxWords: preset.maxWords } : {}),
    })),
  }
  return JSON.stringify(payload, null, 2)
}

export function parseUserPresetFile(input: unknown): UserPreset[] {
  const data = typeof input === "string" ? (JSON.parse(input) as unknown) : input
  if (!isRecord(data) || data.version !== USER_PRESET_FILE_VERSION || !Array.isArray(data.presets)) {
    throw new Error("arquivo de presets inválido")
  }
  const presets: UserPreset[] = []
  for (const raw of data.presets) {
    if (!isRecord(raw)) continue
    if (typeof raw.id !== "string" || !canWritePresetId(raw.id)) continue
    if (typeof raw.label !== "string") continue
    if (!isPresetGroup(raw.group)) continue
    const style = isRecord(raw.style) ? (raw.style as DeepPartial<InsertStyle>) : {}
    try {
      presets.push(
        createUserPreset({
          id: raw.id,
          label: raw.label,
          group: raw.group,
          style,
          maxWords: typeof raw.maxWords === "number" ? raw.maxWords : undefined,
        }),
      )
    } catch {
      continue
    }
  }
  return presets
}

export function parseCustomPresets(input: unknown): Record<string, UserPreset> | undefined {
  if (!isRecord(input)) return undefined
  const parsed = parseUserPresetFile({
    version: USER_PRESET_FILE_VERSION,
    presets: Object.values(input),
  })
  if (parsed.length === 0) return undefined
  return Object.fromEntries(parsed.map((preset) => [preset.id, preset]))
}

export function indexUserPresets(presets: UserPreset[]): Record<string, UserPreset> {
  return Object.fromEntries(presets.map((preset) => [preset.id, preset]))
}

export function upsertCustomPreset(
  current: Record<string, UserPreset> | undefined,
  preset: UserPreset,
): Record<string, UserPreset> {
  return { ...current, [preset.id]: preset }
}

export function removeCustomPreset(
  current: Record<string, UserPreset> | undefined,
  id: string,
): Record<string, UserPreset> | undefined {
  if (!current?.[id]) return current
  const next = { ...current }
  delete next[id]
  return Object.keys(next).length ? next : undefined
}

export function mergePresetCatalog(
  ...lists: Array<UserPreset[] | Record<string, UserPreset> | undefined>
): Record<string, UserPreset> {
  const catalog: Record<string, UserPreset> = {}
  for (const list of lists) {
    if (!list) continue
    const values = Array.isArray(list) ? list : Object.values(list)
    for (const preset of values) {
      if (canWritePresetId(preset.id)) catalog[preset.id] = preset
    }
  }
  return catalog
}

export function presetsUsedInComposition(input: {
  inserts: Array<{ styleRef?: { presetId: string } }>
  tracks?: Partial<Record<string, { styleRef?: { presetId: string } }>>
  styleRef?: { presetId: string }
  customPresets?: Record<string, UserPreset>
}): UserPreset[] {
  const ids = new Set<string>()
  const add = (presetId?: string) => {
    if (presetId && canWritePresetId(presetId)) ids.add(presetId)
  }
  add(input.styleRef?.presetId)
  for (const insert of input.inserts) add(insert.styleRef?.presetId)
  if (input.tracks) {
    for (const track of Object.values(input.tracks)) add(track?.styleRef?.presetId)
  }
  const catalog = input.customPresets ?? {}
  return [...ids]
    .map((id) => catalog[id])
    .filter((preset): preset is UserPreset => Boolean(preset))
}
