import type { StorageLike } from "./project-store.ts"

export type PanelTabId = "video" | "captions" | "inserts"

export type PanelBlockScope =
  | "video"
  | "captions-style"
  | "captions-motion"
  | "inserts-style"
  | "inserts-motion"

export const PANEL_SECTIONS: { id: PanelTabId; label: string }[] = [
  { id: "video", label: "Vídeo" },
  { id: "captions", label: "Legendas" },
  { id: "inserts", label: "Inserts" },
]

export const VIDEO_BLOCK_IDS = ["framing", "watermark"] as const
export const CAPTION_STYLE_BLOCK_IDS = ["type", "layout", "fill", "stroke", "bg", "highlight"] as const
export const INSERT_STYLE_BLOCK_IDS = ["type", "layout", "fill", "stroke", "bg"] as const
export const MOTION_BLOCK_IDS = ["enter", "exit", "loop", "unit"] as const

export const PANEL_UI_STORAGE_KEY = "editor.panel-ui.v1"

const TABS = new Set<PanelTabId>(["video", "captions", "inserts"])
const SCOPES: PanelBlockScope[] = [
  "video",
  "captions-style",
  "captions-motion",
  "inserts-style",
  "inserts-motion",
]

export type PanelUiState = {
  tab: PanelTabId
  blocks: Partial<Record<PanelBlockScope, string[]>>
}

export function defaultPanelUi(): PanelUiState {
  return { tab: "video", blocks: {} }
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isScope(value: string): value is PanelBlockScope {
  return (SCOPES as string[]).includes(value)
}

/** Lê a aba e os blocos conhecidos. Qualquer outra coisa no storage volta ao padrão. */
export function parsePanelUi(raw: string | null): PanelUiState {
  if (!raw) return defaultPanelUi()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return defaultPanelUi()
    const record = parsed as Record<string, unknown>
    const tab = typeof record.tab === "string" && TABS.has(record.tab as PanelTabId)
      ? (record.tab as PanelTabId)
      : "video"
    const blocks: PanelUiState["blocks"] = {}
    const rawBlocks = record.blocks
    if (rawBlocks && typeof rawBlocks === "object") {
      const source = rawBlocks as Record<string, unknown>
      for (const scope of SCOPES) {
        const value = source[scope]
        if (!Array.isArray(value)) continue
        const ids = value.filter((item): item is string => typeof item === "string")
        if (ids.length > 0) blocks[scope] = ids
      }
    }
    return { tab, blocks }
  } catch {
    return defaultPanelUi()
  }
}

export function loadPanelUi(storage: StorageLike | null = defaultStorage()): PanelUiState {
  if (!storage) return defaultPanelUi()
  try {
    return parsePanelUi(storage.getItem(PANEL_UI_STORAGE_KEY))
  } catch (error) {
    console.warn("[editor] não foi possível ler o painel", error)
    return defaultPanelUi()
  }
}

function writePanelUi(next: PanelUiState, storage: StorageLike | null): void {
  if (!storage) return
  try {
    storage.setItem(PANEL_UI_STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    console.warn("[editor] não foi possível salvar o painel", error)
  }
}

export function savePanelTab(tab: PanelTabId, storage: StorageLike | null = defaultStorage()): void {
  if (!TABS.has(tab)) return
  const current = loadPanelUi(storage)
  writePanelUi({ ...current, tab }, storage)
}

export function savePanelBlocks(
  scope: PanelBlockScope,
  ids: string[],
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!isScope(scope)) return
  const current = loadPanelUi(storage)
  const blocks = { ...current.blocks, [scope]: ids }
  writePanelUi({ ...current, blocks }, storage)
}

/**
 * Com um bloco ou nenhum, abrir fecha os outros. Com vários abertos
 * (Expandir tudo), o clique só alterna aquele bloco.
 */
export function togglePanelBlock(open: readonly string[], id: string): string[] {
  if (open.length > 1) {
    return open.includes(id) ? open.filter((item) => item !== id) : [...open, id]
  }
  if (open.length === 1 && open[0] === id) return []
  return [id]
}
