import type { CompositionInsert } from "../composition.ts"
import { patchStyleRef } from "../style/edit-style.ts"
import { getPresetStyle } from "../style/presets.ts"
import type { InsertStyle } from "../style/types.ts"
import { COLOR_SLOTS, isColorSlot, type ColorSlot } from "./kits.ts"

export function slotPaths(value: unknown, prefix = ""): { slot: ColorSlot; path: string }[] {
  const rows: { slot: ColorSlot; path: string }[] = []
  if (typeof value === "string") {
    if (value.startsWith("slot:")) {
      const slot = value.slice(5)
      if (isColorSlot(slot)) rows.push({ slot, path: prefix })
    }
    return rows
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const path = prefix ? `${prefix}.${index}` : String(index)
      rows.push(...slotPaths(item, path))
    })
    return rows
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      rows.push(...slotPaths(item, prefix ? `${prefix}.${key}` : key))
    }
  }
  return rows
}

/** Papéis `slot:` que o preset usa, na ordem da paleta. */
export function slotsInStyle(style: InsertStyle): ColorSlot[] {
  const found = new Set(slotPaths(style).map((row) => row.slot))
  return COLOR_SLOTS.filter((slot) => found.has(slot))
}

/** Grava hex no override do insert, só nos caminhos daquele papel. A paleta do projeto fica. */
export function insertWithSlotHex(insert: CompositionInsert, slot: ColorSlot, hex: string): CompositionInsert {
  const presetId = insert.styleRef?.presetId
  if (!presetId) return insert
  const paths = slotPaths(getPresetStyle(presetId)).filter((row) => row.slot === slot)
  if (paths.length === 0) return insert
  let ref = insert.styleRef
  for (const row of paths) {
    ref = patchStyleRef(ref, row.path, hex)
  }
  return { ...insert, styleRef: ref }
}
