import type { StorageLike } from "./project-store.ts"
import {
  DEFAULT_WATERMARK_PREFS,
  normalizeWatermarkPrefs,
  type WatermarkPrefs,
} from "./watermark.ts"

export const WATERMARK_STORAGE_KEY = "editor.watermark.v1"

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function loadWatermarkPrefs(
  storage: StorageLike | null = defaultStorage(),
): WatermarkPrefs {
  if (!storage) return { ...DEFAULT_WATERMARK_PREFS }
  try {
    const raw = storage.getItem(WATERMARK_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WATERMARK_PREFS }
    return normalizeWatermarkPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_WATERMARK_PREFS }
  }
}

export function saveWatermarkPrefs(
  prefs: WatermarkPrefs,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(
      WATERMARK_STORAGE_KEY,
      JSON.stringify(normalizeWatermarkPrefs(prefs)),
    )
  } catch (error) {
    console.warn("[editor] não gravei a marca d'água", error)
  }
}
