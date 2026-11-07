/** Maior retângulo 9:16 que cabe na área útil, em pixels inteiros. */
export function fitPreviewFrame(
  availWidth: number,
  availHeight: number,
): { width: number; height: number } {
  const widthBudget = Number.isFinite(availWidth) ? Math.max(0, availWidth) : 0
  const heightBudget = Number.isFinite(availHeight) ? Math.max(0, availHeight) : 0
  if (widthBudget < 1 || heightBudget < 1) return { width: 0, height: 0 }
  const widthFromHeight = heightBudget * (9 / 16)
  if (widthFromHeight <= widthBudget) {
    return { width: Math.floor(widthFromHeight), height: Math.floor(heightBudget) }
  }
  return { width: Math.floor(widthBudget), height: Math.floor(widthBudget * (16 / 9)) }
}
