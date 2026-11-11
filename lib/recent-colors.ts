const STORAGE_KEY = "editor.recent-colors.v1"
const LIMIT = 8

function storage(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function loadRecentColors(): string[] {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && /^#[0-9A-Fa-f]{6}$/.test(item)).slice(0, LIMIT)
  } catch {
    return []
  }
}

/** A cor mais nova fica na frente. Repetida sobe, sem passar de 8. */
export function rememberColor(hex: string, current = loadRecentColors()): string[] {
  const next = [hex.toUpperCase(), ...current.filter((item) => item.toUpperCase() !== hex.toUpperCase())].slice(0, LIMIT)
  storage()?.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
