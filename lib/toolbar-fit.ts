const DEFAULT_GAP_PX = 4
const OVERFLOW_BUTTON_PX = 36

/** Quantas peças cabem em até 2 linhas. O resto cabe no botão "…". */
export function visibleToolbarCount(widths: number[], available: number, gap = DEFAULT_GAP_PX): number {
  const fit = (reserve: number) => {
    const budget = Math.max(0, available - reserve)
    if (budget <= 0) return 0
    let row = 1
    let used = 0
    let count = 0
    for (const width of widths) {
      const piece = Math.min(Math.max(width, 1), budget)
      const next = used === 0 ? piece : used + gap + piece
      if (next <= budget) {
        used = next
        count++
        continue
      }
      if (row === 1) {
        row = 2
        used = piece
        count++
        continue
      }
      return count
    }
    return count
  }
  if (widths.length === 0) return 0
  const all = fit(0)
  if (all >= widths.length) return widths.length
  return fit(OVERFLOW_BUTTON_PX)
}
