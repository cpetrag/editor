import { FRESH_OFFER_IDS } from "./offer-styles.ts"

const STORAGE_KEY = "editor-video-used-styles"

export function isFreshOfferStyle(id: string): boolean {
  return FRESH_OFFER_IDS.includes(id)
}

export function readUsedStyles(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []
  } catch {
    return []
  }
}

export function markStyleUsed(id: string): string[] {
  if (!isFreshOfferStyle(id)) return readUsedStyles()
  const next = [...new Set([...readUsedStyles(), id])]
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* o selo volta na próxima visita se o navegador bloquear o armazenamento */
  }
  return next
}
