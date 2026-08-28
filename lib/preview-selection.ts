export type PreviewSelection =
  | { kind: "insert"; id: string }
  | { kind: "source" }
  | null

export function insertIdOf(selection: PreviewSelection): string | null {
  return selection?.kind === "insert" ? selection.id : null
}

export function isSourceSelected(selection: PreviewSelection): boolean {
  return selection?.kind === "source"
}
