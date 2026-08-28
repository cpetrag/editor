function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const DUPLICATE_OFFSET_PCT = 2

export function offsetDuplicatePercents(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x + DUPLICATE_OFFSET_PCT, 0, 100),
    y: clamp(y + DUPLICATE_OFFSET_PCT, 0, 100),
  }
}

export function snapRotationDegrees(deg: number, shift: boolean, step = 15): number {
  if (!shift) return deg
  return Math.round(deg / step) * step
}

export function isDeleteInsertKey(event: { key: string }): boolean {
  return event.key === "Delete" || event.key === "Backspace"
}

export function isDuplicateInsertKey(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
}): boolean {
  if (event.key !== "d" && event.key !== "D") return false
  return event.metaKey || event.ctrlKey
}
