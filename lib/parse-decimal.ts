const DECIMAL = /^-?\d+(\.\d+)?$/

export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(",", ".")
  if (!DECIMAL.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function formatTimecode(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const minutes = Math.floor(clamped / 60)
  const remainder = clamped - minutes * 60
  const wholeSeconds = Math.floor(remainder)
  const tenths = Math.round((remainder - wholeSeconds) * 10)
  if (tenths === 10) {
    return formatTimecode(minutes * 60 + wholeSeconds + 1)
  }
  const padded = wholeSeconds.toString().padStart(2, "0")
  if (tenths === 0) return `${minutes}:${padded}`
  return `${minutes}:${padded},${tenths}`
}

/** One decimal place, comma as separator. Integers stay without a fraction. */
export function formatSeconds(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(1).replace(".", ",")
}
