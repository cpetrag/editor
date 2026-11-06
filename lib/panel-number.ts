/** Arredonda para no máximo `digits` casas. Valores não finitos viram 0. */
export function roundPanelNumber(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Exibição curta: no máximo uma casa, sem zero à direita. */
export function formatPanelNumber(value: number, digits = 1): string {
  const rounded = roundPanelNumber(value, digits)
  const fixed = rounded.toFixed(digits)
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")
}
