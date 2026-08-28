export const PNG_META_KEY = "editor.library-png-meta.v1"
export const MAX_RECENT_PNGS = 24

export type PngFilter = "all" | "recent" | "favorite"

export type LibraryPngMeta = {
  favorites: string[]
  recents: string[]
}

export const EMPTY_PNG_META: LibraryPngMeta = {
  favorites: [],
  recents: [],
}

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parsePngMeta(raw: unknown): LibraryPngMeta {
  const data = typeof raw === "string" ? safeJson(raw) : raw
  if (!isRecord(data)) return { ...EMPTY_PNG_META }
  const favorites = Array.isArray(data.favorites)
    ? data.favorites.filter((item): item is string => typeof item === "string")
    : []
  const recents = Array.isArray(data.recents)
    ? data.recents.filter((item): item is string => typeof item === "string")
    : []
  return { favorites, recents }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function readPngMeta(storage: StorageLike | null = defaultStorage()): LibraryPngMeta {
  if (!storage) return { ...EMPTY_PNG_META }
  return parsePngMeta(storage.getItem(PNG_META_KEY))
}

export function writePngMeta(
  meta: LibraryPngMeta,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  storage.setItem(PNG_META_KEY, JSON.stringify(meta))
}

export function togglePngFavorite(meta: LibraryPngMeta, id: string): LibraryPngMeta {
  const favorites = meta.favorites.includes(id)
    ? meta.favorites.filter((item) => item !== id)
    : [id, ...meta.favorites]
  return { ...meta, favorites }
}

export function touchPngRecent(meta: LibraryPngMeta, id: string): LibraryPngMeta {
  const recents = [id, ...meta.recents.filter((item) => item !== id)].slice(0, MAX_RECENT_PNGS)
  return { ...meta, recents }
}

export function filterPngItems<T extends { id: string }>(
  items: T[],
  filter: PngFilter,
  meta: LibraryPngMeta,
): T[] {
  if (filter === "favorite") {
    const set = new Set(meta.favorites)
    return items.filter((item) => set.has(item.id))
  }
  if (filter === "recent") {
    const byId = new Map(items.map((item) => [item.id, item]))
    return meta.recents.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }
  return items
}
