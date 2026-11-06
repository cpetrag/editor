export const PNG_META_KEY = "editor.library-png-meta.v1"
export const MAX_RECENT_PNGS = 24

export type PngFilter = "all" | "recent" | "favorite"
export type PngBackdrop = "light" | "dark" | "checker"

export const PNG_BACKDROP_KEY = "editor.library-png-backdrop.v1"
export const PNG_BRAND_TAGS = ["Shopee", "Amazon", "Mercado Livre", "Natura", "Black Livros"] as const

export type LibraryPngMeta = {
  favorites: string[]
  recents: string[]
  tags: Record<string, string[]>
}

export const EMPTY_PNG_META: LibraryPngMeta = {
  favorites: [],
  recents: [],
  tags: {},
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
  const tags = isRecord(data.tags)
    ? Object.fromEntries(
        Object.entries(data.tags)
          .filter((entry): entry is [string, string[]] =>
            Array.isArray(entry[1]) && entry[1].every((tag) => typeof tag === "string"),
          )
          .map(([id, list]) => [id, list]),
      )
    : {}
  return { favorites, recents, tags }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function readPngBackdrop(storage: StorageLike | null = defaultStorage()): PngBackdrop {
  if (!storage) return "checker"
  try {
    const value = storage.getItem(PNG_BACKDROP_KEY)
    if (value === "light" || value === "dark" || value === "checker") return value
  } catch {
    return "checker"
  }
  return "checker"
}

export function writePngBackdrop(backdrop: PngBackdrop, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(PNG_BACKDROP_KEY, backdrop)
  } catch (error) {
    console.warn("[editor] não foi possível salvar o fundo das miniaturas", error)
  }
}

export function pngBackdropClass(backdrop: PngBackdrop): string {
  if (backdrop === "light") return "bg-zinc-100"
  if (backdrop === "dark") return "bg-zinc-950"
  return "bg-[image:repeating-conic-gradient(#e7e5e4_0%_25%,#fafafa_0%_50%)] bg-[size:12px_12px]"
}

export function readPngMeta(storage: StorageLike | null = defaultStorage()): LibraryPngMeta {
  if (!storage) return { ...EMPTY_PNG_META, tags: {} }
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

export function setPngTags(meta: LibraryPngMeta, id: string, tags: string[]): LibraryPngMeta {
  return { ...meta, tags: { ...meta.tags, [id]: tags } }
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
