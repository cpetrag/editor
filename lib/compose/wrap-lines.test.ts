import { test } from "node:test"
import assert from "node:assert/strict"

import { wrapLines } from "./wrap-lines.ts"

function measure(value: string): number {
  return value.length * 10
}

test("wrapLines keeps a short sentence on one line", () => {
  assert.deepEqual(wrapLines("ola mundo", 200, measure), ["ola mundo"])
})

test("wrapLines breaks on spaces when the line overflows", () => {
  assert.deepEqual(wrapLines("ola mundo extra", 90, measure), ["ola mundo", "extra"])
})

test("wrapLines honors a manual newline before wrapping", () => {
  assert.deepEqual(wrapLines("ola\nmundo extra", 120, measure), ["ola", "mundo extra"])
})

test("wrapLines breaks inside a token that exceeds maxWidth", () => {
  assert.deepEqual(wrapLines("SUPERPROMOCAOIMPERDIVELHOJE", 80, measure), [
    "SUPERPRO",
    "MOCAOIMP",
    "ERDIVELH",
    "OJE",
  ])
})

test("wrapLines never drops characters of an oversized token", () => {
  const token = "SUPERPROMOCAOIMPERDIVELHOJE"
  const lines = wrapLines(token, 80, measure)
  assert.equal(lines.join(""), token)
  assert.ok(lines.length > 1)
  for (const line of lines) {
    assert.ok(measure(line) <= 80 || line.length === 1)
  }
})

test("wrapLines still emits a character wider than maxWidth", () => {
  assert.deepEqual(wrapLines("AB", 5, measure), ["A", "B"])
})
