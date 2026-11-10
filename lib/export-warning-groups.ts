import type { ExportWarning, ExportWarningCode } from "./export-checklist.ts"

export type ExportWarningGroup = {
  code: ExportWarningCode
  label: string
  warnings: ExportWarning[]
}

const GROUP_LABELS: Record<ExportWarningCode, string> = {
  short: "Muito curtos (abaixo de 0,8 s)",
  overlap: "Coincidem no tempo",
  collision: "Se sobrepõem no quadro",
  "safe-top": "Entram no topo (capa do Reels)",
  "safe-bottom": "Entram na faixa de áudio/legenda",
  "safe-right": "Entram na coluna dos botões",
  "contrast-bare": "Sem fundo nem contorno",
  "contrast-low": "Pouco contraste com o fundo",
  "empty-var": "Variável vazia",
  "audio-silent": "Sem som",
  "audio-cut": "Cortado no fim do vídeo",
  "audio-clip": "Risco de distorção",
  "audio-gap": "Silêncio no final",
  "audio-missing": "Arquivo ausente",
  "audio-pending": "Importação pendente",
  "audio-capcut": "CapCut sem automação",
  "audio-trim": "Corte inválido",
  "insert-past-end": "Passa do fim do vídeo",
}

/** Agrupa avisos do mesmo tipo, na ordem em que o primeiro de cada tipo aparece. */
export function groupExportWarnings(warnings: readonly ExportWarning[]): ExportWarningGroup[] {
  const groups = new Map<ExportWarningCode, ExportWarningGroup>()
  for (const warning of warnings) {
    const group = groups.get(warning.code)
    if (group) {
      group.warnings.push(warning)
      continue
    }
    groups.set(warning.code, {
      code: warning.code,
      label: GROUP_LABELS[warning.code],
      warnings: [warning],
    })
  }
  return [...groups.values()]
}
