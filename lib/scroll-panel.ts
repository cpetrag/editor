export const PANEL_VIEWPORT_SELECTOR =
  '[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]'

/** Quanto rolar o viewport para o elemento ficar visível; 0 = já está visível. */
export function panelScrollDelta(
  element: { top: number; bottom: number },
  viewport: { top: number; bottom: number },
  margin = 8,
): number {
  if (element.top < viewport.top || element.bottom > viewport.bottom) {
    return element.top - viewport.top - margin
  }
  return 0
}

/**
 * Rola só o viewport do ScrollArea que contém `element`. `scrollIntoView` rolaria
 * também os ancestrais (o grid principal), deslocando o preview no meio de um clique.
 */
export function scrollIntoPanelViewport(element: HTMLElement | null, margin = 8): void {
  if (!element) return
  const viewport = element.closest(PANEL_VIEWPORT_SELECTOR)
  if (!(viewport instanceof HTMLElement)) return
  const delta = panelScrollDelta(
    element.getBoundingClientRect(),
    viewport.getBoundingClientRect(),
    margin,
  )
  if (delta !== 0) viewport.scrollBy({ top: delta, behavior: "smooth" })
}
