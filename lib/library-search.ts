import type { Template } from "./inserts.ts"
import type { VisibleElement } from "./library-catalog.ts"

const DIACRITICS = /[\u0300-\u036f]/g

export type LibraryPngItem = {
  id: string
  name: string
  mediaUrl: string
}

export type LibraryFontHit = {
  id: string
  label: string
}

export type LibrarySearchSource = {
  templates: Template[]
  elements: VisibleElement[]
  pngs: LibraryPngItem[]
  fonts: LibraryFontHit[]
}

export type LibrarySearchResult = LibrarySearchSource

export function foldSearch(input: string): string {
  return input.normalize("NFD").replace(DIACRITICS, "").toLowerCase()
}

export function matchesQuery(haystack: string, query: string): boolean {
  const needle = foldSearch(query).trim()
  if (!needle) return true
  return foldSearch(haystack).includes(needle)
}

export function midTruncate(value: string, max = 20): string {
  if (value.length <= max) return value
  return `${value.slice(0, 11)}…${value.slice(-8)}`
}

export function searchLibrary(query: string, source: LibrarySearchSource): LibrarySearchResult {
  return {
    templates: source.templates.filter(
      (item) =>
        matchesQuery(item.name, query) ||
        matchesQuery(item.description, query) ||
        item.inserts.some((insert) => matchesQuery(insert.type, query) || matchesQuery(insert.text ?? "", query)) ||
        (item.beats ?? []).some(
          (beat) =>
            matchesQuery(beat.text ?? "", query) ||
            matchesQuery(beat.presetId ?? "", query) ||
            matchesQuery(beat.elementId ?? "", query),
        ),
    ),
    elements: source.elements.filter(
      (item) => matchesQuery(item.label, query) || matchesQuery(item.type, query),
    ),
    pngs: source.pngs.filter((item) => matchesQuery(item.name, query)),
    fonts: source.fonts.filter((item) => matchesQuery(item.label, query) || matchesQuery(item.id, query)),
  }
}

export function countLibraryResults(result: LibrarySearchResult): number {
  return result.templates.length + result.elements.length + result.pngs.length + result.fonts.length
}

export function formatLibrarySearchSubtitle(query: string, count: number): string {
  const term = query.trim()
  if (!term) {
    return "Combos, elementos, PNGs e fontes — clique para aplicar no projeto."
  }
  if (count === 1) return `1 resultado para "${term}"`
  return `${count} resultados para "${term}"`
}
