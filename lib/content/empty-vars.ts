import { insertKind, type CompositionInsert } from "../composition.ts"
import type { ExportWarning } from "../export-checklist.ts"
import { fillVars, plainMarkedText, type ProductData } from "./runs.ts"

export function emptyVariableWarnings(
  inserts: CompositionInsert[],
  data: ProductData | undefined,
): ExportWarning[] {
  const hits = inserts.filter((insert) => {
    if (insertKind(insert) !== "text") return false
    return fillVars(insert.text ?? "", data).empty.length > 0
  })
  if (hits.length === 0) return []
  const names = hits.map((insert) => `“${plainMarkedText(insert.text ?? "", data).slice(0, 42)}”`).join(", ")
  return [
    {
      id: "empty-var",
      code: "empty-var",
      insertIds: hits.map((insert) => insert.id),
      title: `${hits.length} insert${hits.length === 1 ? "" : "s"} com variável vazia: ${names}. Se continuar, a variável some do vídeo.`,
    },
  ]
}
