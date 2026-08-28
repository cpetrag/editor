import type { StorageLike } from "../project-store.ts"

export const EXPORT_PREFS_KEY = "editor.export.v1"

export type ExportPrefs = {
  saveToCapcut: boolean
}

export const DEFAULT_EXPORT_PREFS: ExportPrefs = {
  saveToCapcut: true,
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function loadExportPrefs(
  storage: StorageLike | null = defaultStorage(),
): ExportPrefs {
  if (!storage) return { ...DEFAULT_EXPORT_PREFS }
  try {
    const raw = storage.getItem(EXPORT_PREFS_KEY)
    if (!raw) return { ...DEFAULT_EXPORT_PREFS }
    const parsed = JSON.parse(raw) as { saveToCapcut?: unknown }
    if (typeof parsed.saveToCapcut !== "boolean") return { ...DEFAULT_EXPORT_PREFS }
    return { saveToCapcut: parsed.saveToCapcut }
  } catch {
    return { ...DEFAULT_EXPORT_PREFS }
  }
}

export function saveExportPrefs(
  prefs: ExportPrefs,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(EXPORT_PREFS_KEY, JSON.stringify({ saveToCapcut: prefs.saveToCapcut }))
  } catch (error) {
    console.warn("[editor] não gravei as prefs de export", error)
  }
}
