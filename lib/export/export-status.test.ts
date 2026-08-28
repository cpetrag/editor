import assert from "node:assert/strict"
import { test } from "node:test"

import {
  exportPhaseLabel,
  finalDownloadProgress,
  finalRenderProgress,
  formatExportStatus,
  formatCapcutOnlySavedMessage,
  formatExportSavedMessage,
  draftEncodeProgress,
  formatElapsedClock,
} from "./export-status.ts"

test("finalRenderProgress nunca chega a 100% mesmo com o render em 1", () => {
  assert.equal(finalRenderProgress(0), 0.08)
  assert.ok(finalRenderProgress(0.4) > 0.08)
  assert.ok(finalRenderProgress(0.4) < 0.85)
  assert.equal(finalRenderProgress(1), 0.85)
})

test("finalDownloadProgress vai de 85% a 97%", () => {
  assert.equal(finalDownloadProgress(0), 0.85)
  assert.equal(finalDownloadProgress(1), 0.97)
})

test("draftEncodeProgress deixa folga para salvar", () => {
  assert.equal(draftEncodeProgress(0), 0)
  assert.equal(draftEncodeProgress(1), 0.95)
})

test("exportPhaseLabel descreve o passo atual", () => {
  assert.match(exportPhaseLabel("uploading"), /enviando/i)
  assert.match(exportPhaseLabel("rendering"), /gerando/i)
  assert.match(exportPhaseLabel("downloading"), /baixando/i)
  assert.match(exportPhaseLabel("saving"), /capcut/i)
  assert.match(exportPhaseLabel("encoding"), /rascunho/i)
})

test("formatElapsedClock formata minutos e segundos", () => {
  assert.equal(formatElapsedClock(0), "0:00")
  assert.equal(formatElapsedClock(47), "0:47")
  assert.equal(formatElapsedClock(80), "1:20")
})

test("formatExportStatus junta o passo e a porcentagem", () => {
  assert.equal(formatExportStatus("downloading", 0.92), "Baixando o MP4… 92%")
})

test("no começo do render Final mostra tempo decorrido em vez de 8% congelado", () => {
  const start = formatExportStatus("rendering", 0.08, 47)
  assert.match(start, /gerando/i)
  assert.match(start, /0:47/)
  assert.doesNotMatch(start, /8%/)
  assert.match(formatExportStatus("rendering", 0.2, 47), /20%/)
})

test("formatExportSavedMessage combina disco e pasta CapCut", () => {
  assert.match(
    formatExportSavedMessage({ disk: "picked", capcut: "saved" }),
    /computador.*capcut/i,
  )
  assert.match(
    formatExportSavedMessage({ disk: "cancelled", capcut: "saved" }),
    /capcut/i,
  )
  assert.match(
    formatExportSavedMessage({ disk: "cancelled", capcut: "skipped" }),
    /cancelou/i,
  )
  assert.match(
    formatExportSavedMessage({ disk: "picked", capcut: "failed" }),
    /não deu para copiar/i,
  )
})

test("formatCapcutOnlySavedMessage cita o nome do arquivo", () => {
  assert.match(formatCapcutOnlySavedMessage("Meu Anúncio.mp4"), /Meu Anúncio\.mp4/)
  assert.match(formatCapcutOnlySavedMessage(""), /video\.mp4/)
})
