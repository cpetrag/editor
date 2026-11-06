export type PreviewSelection =
  | { kind: "insert"; id: string; ids?: readonly string[] }
  | { kind: "source" }
  | null

export function insertIdOf(selection: PreviewSelection): string | null {
  return selection?.kind === "insert" ? selection.id : null
}

export function isSourceSelected(selection: PreviewSelection): boolean {
  return selection?.kind === "source"
}

/** Ids da seleção múltipla. Sem `ids`, vale só o item principal. */
export function selectedIdsOf(selection: PreviewSelection): string[] {
  if (selection?.kind !== "insert") return []
  const listed = selection.ids
  if (!listed || listed.length === 0) return [selection.id]
  const unique: string[] = []
  for (const id of listed) {
    if (id && !unique.includes(id)) unique.push(id)
  }
  if (!unique.includes(selection.id)) unique.push(selection.id)
  return unique
}

/** Um id só fica no formato antigo (`{ kind, id }`), para o resto do editor. */
export function insertSelection(primaryId: string, ids: readonly string[]): PreviewSelection {
  const unique: string[] = []
  for (const id of ids) {
    if (id && !unique.includes(id)) unique.push(id)
  }
  if (!unique.includes(primaryId)) unique.unshift(primaryId)
  if (unique.length === 0) return null
  const primary = unique.includes(primaryId) ? primaryId : unique[unique.length - 1]!
  if (unique.length === 1) return { kind: "insert", id: primary }
  return { kind: "insert", id: primary, ids: unique }
}

export function pruneInsertSelection(
  selection: PreviewSelection,
  aliveIds: ReadonlySet<string>,
): PreviewSelection {
  if (selection?.kind !== "insert") return selection
  const alive = selectedIdsOf(selection).filter((id) => aliveIds.has(id))
  if (alive.length === 0) return null
  const primary = alive.includes(selection.id) ? selection.id : alive[alive.length - 1]!
  return insertSelection(primary, alive)
}
