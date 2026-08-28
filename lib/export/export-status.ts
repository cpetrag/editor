export type ExportPhase =
  | "uploading"
  | "rendering"
  | "downloading"
  | "saving"
  | "encoding"

const PHASE_LABEL: Record<ExportPhase, string> = {
  uploading: "Enviando o vídeo para o Mac…",
  rendering: "O Mac está gerando o vídeo…",
  downloading: "Baixando o MP4…",
  saving: "Confirmando o arquivo na pasta CapCut…",
  encoding: "Montando o rascunho neste navegador. Mantenha a aba visível.",
}

export function exportPhaseLabel(phase: ExportPhase): string {
  return PHASE_LABEL[phase]
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0
  return Math.min(1, Math.max(0, ratio))
}

export function scaleProgress(from: number, to: number, ratio: number): number {
  return from + (to - from) * clampRatio(ratio)
}

export function finalRenderProgress(renderRatio: number): number {
  return scaleProgress(0.08, 0.85, renderRatio)
}

export function finalDownloadProgress(downloadRatio: number): number {
  return scaleProgress(0.85, 0.97, downloadRatio)
}

export function draftEncodeProgress(encodeRatio: number): number {
  return scaleProgress(0, 0.95, encodeRatio)
}

export function formatElapsedClock(elapsedSeconds = 0): string {
  const total = Math.max(0, Math.floor(elapsedSeconds))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function formatExportStatus(
  phase: ExportPhase,
  ratio: number,
  elapsedSeconds = 0,
): string {
  const pct = Math.round(clampRatio(ratio) * 100)
  if (phase === "rendering" && pct <= 8) {
    return `${exportPhaseLabel(phase)} ${formatElapsedClock(elapsedSeconds)}`
  }
  return `${exportPhaseLabel(phase)} ${pct}%`
}

export type DiskSaveResult = "picked" | "download" | "cancelled"
export type CapcutSaveResult = "saved" | "failed" | "skipped"

export function formatExportSavedMessage(input: {
  disk: DiskSaveResult
  capcut: CapcutSaveResult
}): string {
  if (input.disk === "cancelled" && input.capcut === "saved") {
    return "Vídeo pronto na pasta CapCut. Você cancelou o salvamento neste computador."
  }
  if (input.disk === "cancelled" && input.capcut === "failed") {
    return "Você cancelou o salvamento neste computador. Não deu para copiar para a pasta CapCut."
  }
  if (input.disk === "cancelled") {
    return "Vídeo pronto. Você cancelou o salvamento."
  }
  if (input.capcut === "saved") {
    return "Export salvo neste computador e na pasta CapCut."
  }
  if (input.capcut === "failed") {
    return "Export salvo neste computador. Não deu para copiar para a pasta CapCut."
  }
  return "Export concluído"
}

/** Mensagem quando o Final só grava na pasta CapCut (sem cópia local). */
export function formatCapcutOnlySavedMessage(fileName: string): string {
  const name = fileName.trim() || "video.mp4"
  return `Vídeo salvo na pasta CapCut: ${name}`
}
