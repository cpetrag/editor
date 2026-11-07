import assert from "node:assert/strict"
import test from "node:test"

import { wrapLines } from "../compose/wrap-lines.ts"
import { graphemes, displayRuns, fillVars, formatPrice, parseRuns, readingSeconds } from "./runs.ts"

test("parseRuns marca destaque, riscado e escape", () => {
  assert.deepEqual(parseRuns("Achei na Shopee e *não acreditei*"), [
    { text: "Achei na Shopee e " },
    { text: "não acreditei", accent: true },
  ])
  assert.deepEqual(parseRuns("~~{preco_de}~~ *{preco}*"), [
    { text: "{preco_de}", strike: true },
    { text: " " },
    { text: "{preco}", accent: true },
  ])
  assert.deepEqual(parseRuns("\\*nao\\* e \\~\\~"), [{ text: "*nao* e ~~" }])
})

test("parseRuns deixa aninhamento inválido e marca aberta como texto", () => {
  assert.deepEqual(parseRuns("*foo ~~bar~~*"), [{ text: "*foo ~~bar~~*" }])
  assert.deepEqual(parseRuns("~~*x*~~"), [{ text: "~~*x*~~" }])
  assert.deepEqual(parseRuns("*aberto"), [{ text: "*aberto" }])
  assert.deepEqual(parseRuns("sem marca"), [{ text: "sem marca" }])
})

test("fillVars troca na hora e avisa variável vazia", () => {
  const filled = fillVars("custa *{preco}*", { preco: "R$ 49,90" })
  assert.equal(filled.text, "custa *R$ 49,90*")
  assert.deepEqual(filled.empty, [])
  const empty = fillVars("custa {preco}", {})
  assert.equal(empty.text, "custa {preco}")
  assert.deepEqual(empty.empty, ["preco"])
  const stripped = fillVars("custa {preco} agora", {}, { stripEmpty: true })
  assert.equal(stripped.text.includes("{preco}"), false)
})

test("formatPrice aceita 49,9", () => {
  assert.equal(formatPrice("49,9"), "R$ 49,90")
  assert.equal(formatPrice("49.9"), "R$ 49,90")
  assert.equal(formatPrice("R$ 49,90"), "R$ 49,90")
})

test("quebra não corta palavra e \n força linha", () => {
  const measure = (value: string) => value.length * 10
  assert.deepEqual(wrapLines("um dois", 25, measure, false), ["um", "dois"])
  assert.deepEqual(wrapLines("um\ndois", 100, measure, false), ["um", "dois"])
  assert.deepEqual(wrapLines("palavra", 30, measure, false), ["palavra"])
})

test("Intl.Segmenter conta emoji com ZWJ como um grafema", () => {
  const family = "👩‍🦱"
  assert.equal(graphemes(family).length, 1)
  assert.equal(graphemes("ab").length, 2)
})

test("displayRuns tira a marcação e guarda o destaque", () => {
  const shown = displayRuns("Achei *não*", { }, { uppercase: true })
  assert.equal(shown.plain, "ACHEI não")
  assert.equal(shown.spans.some((span) => span.accent), true)
})

test("medidor de leitura soma 0,6 s mais 0,25 s por palavra", () => {
  assert.equal(readingSeconds("uma duas"), 1.1)
})
