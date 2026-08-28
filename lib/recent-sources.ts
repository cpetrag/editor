export const RECENT_SOURCES_KEY = "editor.recent-sources.v1"
export const MAX_RECENT_SOURCES = 8

export type RecentSource = {
  canonicalUrl: string
  provider?: string
  author?: string
  title?: string
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

export function readRecentSources(storage: StorageLike | null = defaultStorage()): RecentSource[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(RECENT_SOURCES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const items: RecentSource[] = []
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue
      const record = entry as Record<string, unknown>
      if (typeof record.canonicalUrl !== "string" || !record.canonicalUrl) continue
      items.push({
        canonicalUrl: record.canonicalUrl,
        ...(typeof record.provider === "string" ? { provider: record.provider } : {}),
        ...(typeof record.author === "string" ? { author: record.author } : {}),
        ...(typeof record.title === "string" ? { title: record.title } : {}),
      })
    }
    return items.slice(0, MAX_RECENT_SOURCES)
  } catch {
    return []
  }
}

export function pushRecentSource(
  item: RecentSource,
  storage: StorageLike | null = defaultStorage(),
): RecentSource[] {
  if (!storage || !item.canonicalUrl) return readRecentSources(storage)
  const rest = readRecentSources(storage).filter(
    (entry) => entry.canonicalUrl !== item.canonicalUrl,
  )
  const next = [item, ...rest].slice(0, MAX_RECENT_SOURCES)
  storage.setItem(RECENT_SOURCES_KEY, JSON.stringify(next))
  return next
}
