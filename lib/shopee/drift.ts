import { numbersIn } from "./format.ts"
import type { ShopeeInsertSource } from "./types.ts"

export function importedOnLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "dado real"
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return `dado real · importado em ${day}`
}

/** O número do dado importado sumiu ou mudou no texto editado. */
export function sourceDrifted(text: string, source: ShopeeInsertSource | undefined): boolean {
  if (!source || source.kind !== "shopee" || !source.snapshot) return false
  const expected = numbersIn(source.snapshot)
  if (expected.length === 0) return false
  const current = new Set(numbersIn(text))
  return expected.some((value) => !current.has(value))
}
