import assert from "node:assert/strict"
import { test } from "node:test"

import {
  clampSourceTrim,
  clampToTrim,
  markTrimIn,
  markTrimOut,
  parseSourceTrim,
  resolveTrimWindow,
  trimProgress,
} from "./source-trim.ts"

test("clampSourceTrim descarta janela que cobre o vídeo inteiro", () => {
  assert.equal(clampSourceTrim({ start: 0, end: 20 }, 20), null)
  assert.equal(clampSourceTrim({ start: -1, end: 99 }, 20), null)
  assert.equal(clampSourceTrim(null, 20), null)
  assert.equal(clampSourceTrim({ start: 2, end: 5 }, 0), null)
})

test("clampSourceTrim garante duração mínima e limites do vídeo", () => {
  assert.deepEqual(clampSourceTrim({ start: 3, end: 3.1 }, 20), { start: 3, end: 3.5 })
  assert.deepEqual(clampSourceTrim({ start: 19.9, end: 25 }, 20), { start: 19.5, end: 20 })
  assert.deepEqual(clampSourceTrim({ start: 2.123, end: 8.456 }, 20), { start: 2.12, end: 8.46 })
})

test("resolveTrimWindow usa o vídeo inteiro sem corte", () => {
  assert.deepEqual(resolveTrimWindow({ duration: 12 }), { start: 0, end: 12, duration: 12 })
  assert.deepEqual(resolveTrimWindow({ duration: 12, trim: { start: 2, end: 9 } }), {
    start: 2,
    end: 9,
    duration: 7,
  })
})

test("markTrimIn e markTrimOut marcam no playhead", () => {
  const withIn = markTrimIn(null, 3, 20)
  assert.deepEqual(withIn, { start: 3, end: 20 })
  assert.deepEqual(markTrimOut(withIn, 12, 20), { start: 3, end: 12 })
})

test("entrada depois da saída descarta a saída; saída antes da entrada descarta a entrada", () => {
  assert.deepEqual(markTrimIn({ start: 2, end: 8 }, 10, 20), { start: 10, end: 20 })
  assert.deepEqual(markTrimOut({ start: 10, end: 20 }, 4, 20), { start: 0, end: 4 })
})

test("marcar entrada em 0 sem saída limpa o corte", () => {
  assert.equal(markTrimIn(null, 0, 20), null)
})

test("parseSourceTrim aceita JSON salvo e recusa lixo", () => {
  assert.deepEqual(parseSourceTrim({ start: 1, end: 4 }, 10), { start: 1, end: 4 })
  assert.deepEqual(parseSourceTrim({ start: 1, end: 4 }, 0), { start: 1, end: 4 })
  assert.equal(parseSourceTrim({ start: "1", end: 4 }, 10), null)
  assert.equal(parseSourceTrim(null, 10), null)
  assert.equal(parseSourceTrim({ start: 5, end: 2 }, 0), null)
})

test("trimProgress mede o avanço dentro da janela", () => {
  const window = { start: 2, end: 12, duration: 10 }
  assert.equal(trimProgress(2, window), 0)
  assert.equal(trimProgress(7, window), 0.5)
  assert.equal(trimProgress(15, window), 1)
  assert.equal(trimProgress(1, window), 0)
})

test("clampToTrim prende o playhead na janela", () => {
  const window = { start: 2, end: 9, duration: 7 }
  assert.equal(clampToTrim(0, window), 2)
  assert.equal(clampToTrim(5, window), 5)
  assert.equal(clampToTrim(12, window), 9)
})
