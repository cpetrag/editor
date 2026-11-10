import assert from "node:assert/strict"
import test from "node:test"

import { CONTENT_PRESETS } from "./presets.ts"
import { FRESH_OFFER_IDS, listOfferPresets } from "../style/offer-styles.ts"
import {
  buildReadyInsert,
  fitReadyWindow,
  formatClockTenths,
  galleryRecipes,
  galleryStyles,
  insertWithStyle,
  stripMarks,
  thumbGridMetrics,
  wrapMarkup,
} from "./gallery.ts"

test("encaixa 3s no playhead e recua quando sobra menos de 1s", () => {
  assert.deepEqual(fitReadyWindow(4, 3, 20), { start: 4, duration: 3 })
  assert.deepEqual(fitReadyWindow(18.2, 3, 20), { start: 18.2, duration: 1.8 })
  assert.deepEqual(fitReadyWindow(12.7, 2.1, 14.2), { start: 12.7, duration: 1.5 })
  const backed = fitReadyWindow(19.2, 3, 20)
  assert.equal(backed.start, 18.5)
  assert.equal(backed.duration, 1.5)
})

test("relógio com décimo e vírgula", () => {
  assert.equal(formatClockTenths(4), "0:04,0")
  assert.equal(formatClockTenths(65.4), "1:05,4")
})

test("receitas sem variável vazia vêm primeiro", () => {
  const rows = galleryRecipes({ niche: "shopee", slot: "oferta", query: "", productData: {} })
  const firstMissing = rows.findIndex((preset) => preset.text.includes("{"))
  const lastReady = rows.findLastIndex((preset) => !preset.text.includes("{"))
  if (firstMissing >= 0 && lastReady >= 0) assert.ok(lastReady < firstMissing)
})

test("geral e todos mostram 93 textos e 13 estilos novos", () => {
  assert.equal(CONTENT_PRESETS.length, 93)
  assert.equal(FRESH_OFFER_IDS.length, 13)
  assert.equal(
    galleryRecipes({ niche: "shopee", slot: "todos", query: "", productData: { produto: "x", preco: "1", preco_de: "2", desconto: "10", cupom: "A", nota: "5", vendidos: "1", tamanhos: "M", qtd: "2" } }).length,
    93,
  )
})

test("só estilos lista os 35, com o momento na frente", () => {
  assert.equal(galleryStyles("todos").length, listOfferPresets().length)
  assert.equal(galleryStyles("todos").length, 35)
  assert.ok(galleryStyles("oferta")[0]?.slots.includes("oferta"))
})

test("clique da galeria nasce no playhead com estilo e pacote", () => {
  const insert = buildReadyInsert(
    { text: "Chegou em *3 dias*", styleId: "balao", packId: "digitacao", y: 66, contentId: "prova-shopee-2" },
    4,
    20,
  )
  assert.equal(insert.start, 4)
  assert.equal(insert.duration, 3)
  assert.equal(insert.text, "Chegou em *3 dias*")
  assert.equal(insert.y, 66)
  assert.equal(insert.styleRef?.presetId, "balao")
  assert.equal(insert.styleRef?.overrides.animation?.packId, "digitacao")
})

test("trocar o estilo conserva texto, tempo e posição", () => {
  const insert = buildReadyInsert(
    { text: "Chegou em *3 dias*", styleId: "balao", packId: "digitacao", y: 66, contentId: "prova-shopee-2" },
    4,
    20,
  )
  const next = insertWithStyle(insert, "editorial")
  assert.equal(next.text, insert.text)
  assert.equal(next.start, insert.start)
  assert.equal(next.duration, insert.duration)
  assert.equal(next.y, insert.y)
  assert.equal(next.styleRef?.presetId, "editorial")
  assert.equal(next.styleRef?.overrides.animation?.packId, "digitacao")
})

test("destacar envolve e remove a marcação", () => {
  const wrapped = wrapMarkup("chegou em 3 dias", 10, 16, "*")
  assert.equal(wrapped?.text, "chegou em *3 dias*")
  const undone = wrapMarkup(wrapped?.text ?? "", wrapped?.start ?? 0, wrapped?.end ?? 0, "*")
  assert.equal(undone?.text, "chegou em 3 dias")
})

test("painel de 436 px usa 2 colunas nos prontos e 3 nos estilos", () => {
  const ready = thumbGridMetrics(436, "prontos")
  const styles = thumbGridMetrics(436, "estilos")
  assert.equal(ready.columns, 2)
  assert.equal(ready.gap, 10)
  assert.equal(styles.columns, 3)
  assert.equal(styles.gap, 6)
  assert.ok(Math.abs(ready.cardWidth - (436 - 10) / 2) < 0.01)
  assert.ok(Math.abs(ready.scale - (ready.cardWidth / 1080) * 1.45) < 1e-9)
  assert.ok(Math.abs(styles.scale - (styles.cardWidth / 1080) * 1.6) < 1e-9)
  assert.equal(thumbGridMetrics(279, "prontos").columns, 1)
  assert.equal(thumbGridMetrics(279, "estilos").columns, 2)
})

test("rótulo da timeline perde asterisco e riscado", () => {
  assert.equal(stripMarks("~~R$ 89~~ *R$ 49*"), "R$ 89 R$ 49")
})
