import type { StorageLike } from "./project-store.ts"

export type PanelSectionId = "video" | "captions" | "inserts"

export const PANEL_SECTIONS: { id: PanelSectionId; label: string }[] = [
  { id: "video", label: "Vídeo" },
  { id: "captions", label: "Legendas" },
  { id: "inserts", label: "Inserts" },
]

export const PANEL_SECTIONS_STORAGE_KEY = "editor.panel-sections.v1"

export type CollapsedSections = Record<PanelSectionId, boolean>

export const DEFAULT_COLLAPSED_SECTIONS: CollapsedSections = {
  video: false,
  captions: false,
  inserts: false,
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Lê só booleanos conhecidos; qualquer outra coisa no storage volta ao padrão. */
export function parseCollapsedSections(raw: string | null): CollapsedSections {
  if (!raw) return { ...DEFAULT_COLLAPSED_SECTIONS }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_COLLAPSED_SECTIONS }
    const record = parsed as Record<string, unknown>
    const next = { ...DEFAULT_COLLAPSED_SECTIONS }
    for (const { id } of PANEL_SECTIONS) {
      if (typeof record[id] === "boolean") next[id] = record[id]
    }
    return next
  } catch {
    return { ...DEFAULT_COLLAPSED_SECTIONS }
  }
}

export function loadCollapsedSections(storage: StorageLike | null = defaultStorage()): CollapsedSections {
  if (!storage) return { ...DEFAULT_COLLAPSED_SECTIONS }
  try {
    return parseCollapsedSections(storage.getItem(PANEL_SECTIONS_STORAGE_KEY))
  } catch (error) {
    console.warn("[editor] não foi possível ler as seções do painel", error)
    return { ...DEFAULT_COLLAPSED_SECTIONS }
  }
}

export function saveCollapsedSections(
  sections: CollapsedSections,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(PANEL_SECTIONS_STORAGE_KEY, JSON.stringify(sections))
  } catch (error) {
    console.warn("[editor] não foi possível salvar as seções do painel", error)
  }
}
