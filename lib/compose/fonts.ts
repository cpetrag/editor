import { parseFontId, WEIGHTS_BY_FONT, type FontId } from "./insert-style.ts"
import { factoryPresetFontIds, getPresetStyle } from "../style/presets.ts"
import type { InsertStyle, StyleRef } from "../style/types.ts"
import { getTextPreset, isTextPresetId } from "../text-presets/catalog.ts"
import { fontIdFromFamily } from "../text-presets/to-insert-style.ts"
import { ensureTextPresetFontsReady, TEXT_PRESET_FONT_FILES } from "../text-presets/fonts.ts"

const HOSTED_TEXT_PRESET_FONT_IDS = new Set<string>(
  TEXT_PRESET_FONT_FILES.map((spec) => spec.id),
)

const FAMILIES: Record<string, string> = {
  geist: "Geist, sans-serif",
  poppins: "Poppins, sans-serif",
  bebas: '"Bebas Neue", sans-serif',
  archivo: '"Archivo Black", sans-serif',
  playfair: '"Playfair Display", serif',
  space: '"Space Grotesk", sans-serif',
  oswald: '"Oswald", sans-serif',
  montserrat: "Montserrat, sans-serif",
  anton: "Anton, sans-serif",
  inter: "Inter, sans-serif",
  alfa: '"Alfa Slab One", serif',
  nunito: "Nunito, sans-serif",
  lilita: '"Lilita One", sans-serif',
  luckiest: '"Luckiest Guy", sans-serif',
  baloo: '"Baloo 2", sans-serif',
  titan: '"Titan One", sans-serif',
  caveat: "Caveat, cursive",
  courier: '"Courier Prime", monospace',
}

export function canvasFontFamily(fontId: string): string {
  const canonical = parseFontId(fontId) ?? fontId
  return FAMILIES[canonical] ?? FAMILIES.geist ?? "sans-serif"
}

function uniqueFontIds(fontIds: string | readonly string[]): string[] {
  const list = typeof fontIds === "string" ? [fontIds] : [...fontIds]
  const unique: string[] = []
  for (const id of list) {
    const parsed = parseFontId(id) ?? (FAMILIES[id] ? id : "geist")
    if (!unique.includes(parsed)) unique.push(parsed)
  }
  return unique
}

function addFamily(ids: Set<string>, family: string | undefined): void {
  if (!family) return
  ids.add(parseFontId(family) ?? family)
}

function addStyleRef(ids: Set<string>, styleRef: StyleRef | undefined): void {
  if (!styleRef) return
  addFamily(ids, getPresetStyle(styleRef.presetId).text.fontFamily)
  addFamily(ids, styleRef.overrides.text?.fontFamily)
}

export function fontIdsUsedInComposition(composition: {
  brand: { fontId: string }
  inserts: Array<{
    style?: { fontFamily: string }
    fontFamily?: string
    styleRef?: StyleRef
    preset?: string
    kind?: string
    type?: string
  }>
  captionStyle?: { fontFamily: string }
  styleRef?: StyleRef
  tracks?: Partial<Record<string, { styleRef?: StyleRef }>>
  customPresets?: Record<string, { style: InsertStyle }>
}): string[] {
  const ids = new Set<string>()
  ids.add(parseFontId(composition.brand.fontId) ?? "geist")
  addFamily(ids, composition.captionStyle?.fontFamily)
  addStyleRef(ids, composition.styleRef)
  if (composition.tracks) {
    for (const track of Object.values(composition.tracks)) {
      addStyleRef(ids, track?.styleRef)
    }
  }
  if (composition.customPresets) {
    for (const preset of Object.values(composition.customPresets)) {
      addFamily(ids, preset.style.text.fontFamily)
    }
  }
  for (const insert of composition.inserts) {
    addFamily(ids, insert.style?.fontFamily)
    addFamily(ids, insert.fontFamily)
    addStyleRef(ids, insert.styleRef)
    if (isTextPresetId(insert.preset)) {
      addFamily(ids, fontIdFromFamily(getTextPreset(insert.preset).font.family))
    }
  }
  return [...ids]
}

export function fontIdsForRender(composition: Parameters<typeof fontIdsUsedInComposition>[0]): string[] {
  const ids = new Set(fontIdsUsedInComposition(composition))
  for (const id of factoryPresetFontIds()) addFamily(ids, id)
  return [...ids]
}

export async function ensureComposeFontsReady(
  fontIds: string | readonly string[],
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return
  const ids = uniqueFontIds(fontIds)
  if (ids.some((id) => HOSTED_TEXT_PRESET_FONT_IDS.has(id))) {
    await ensureTextPresetFontsReady()
  }
  const loads: Promise<FontFace[]>[] = []
  for (const id of ids) {
    const family = canvasFontFamily(id)
    const fontId = (parseFontId(id) ?? id) as FontId
    const weights = WEIGHTS_BY_FONT[fontId] ?? WEIGHTS_BY_FONT.geist
    for (const weight of weights) {
      loads.push(document.fonts.load(`${weight} 56px ${family}`))
    }
  }
  try {
    await Promise.all(loads)
  } catch (error) {
    console.error("[editor] falha ao carregar fonte de overlay", error)
  }
}
