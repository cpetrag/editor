import assert from "node:assert/strict"
import test from "node:test"

import { fitCaptionLinesToOutput, linesToCaptionInserts, type CaptionLine } from "../captions.ts"
import { clampInsert } from "../composition.ts"
import { createInsert } from "../inserts.ts"
import { getOutputDuration } from "./duration.ts"

const STARTS = [0, 1.34, 2.06, 3.24, 4.42, 5.72, 6.84, 8.82, 10.04, 11.5, 12.32, 13.22]

function boomerang() {
  return getOutputDuration({
    source: {
      duration: 5.733,
      fps: 30,
      playback: { speed: 0.85, fill: "pingpong", fit: "manual", targetDuration: 14.6 },
    },
  })
}

function linesUntil(end: number): CaptionLine[] {
  return STARTS.map((start, index) => {
    const next = STARTS[index + 1] ?? end
    return {
      text: `linha ${index + 1}`,
      start,
      duration: Math.max(0.2, next - start),
      words: [{ text: `linha ${index + 1}`, start, end: next }],
    }
  })
}

test("legendas da IA até 14,12s ficam na timeline de 14,6s, não na fonte de 5,733s", () => {
  const output = boomerang()
  assert.ok(output > 14)
  assert.ok(output < 15)
  const fitted = fitCaptionLinesToOutput(linesUntil(14.12), output)
  assert.equal(fitted.dropped, 0)
  const inserts = linesToCaptionInserts(fitted.lines, output)
  assert.equal(inserts.length, STARTS.length)
  STARTS.forEach((start, index) => {
    assert.ok(Math.abs((inserts[index]?.start ?? -1) - start) < 0.05, `linha ${index} em ${inserts[index]?.start}`)
  })
  assert.ok((inserts[6]?.start ?? 0) > 6)
  assert.ok((inserts[11]?.start ?? 0) > 12)
  for (let index = 1; index < inserts.length; index += 1) {
    const previous = inserts[index - 1]!
    const current = inserts[index]!
    assert.ok(current.start >= previous.start + previous.duration - 0.05)
  }
})

test("linha que passa do fim da timeline é cortada ou descartada, sem voltar para a fonte", () => {
  const output = boomerang()
  const lines = [
    ...linesUntil(14.12),
    { text: "depois", start: 15.2, duration: 1, words: [{ text: "depois", start: 15.2, end: 16.2 }] },
  ]
  const fitted = fitCaptionLinesToOutput(lines, output)
  assert.equal(fitted.dropped, 1)
  assert.equal(fitted.lines.at(-1)?.text, "linha 12")
  const inserts = linesToCaptionInserts(fitted.lines, output)
  assert.ok(inserts.every((insert) => insert.start < output))
  assert.ok(inserts.every((insert) => insert.start + insert.duration <= output + 0.05))
})

test("insert da IA com start 9s continua em 9s na timeline alongada", () => {
  const output = boomerang()
  const draft = createInsert("cupom")
  draft.start = 9
  draft.duration = 3
  draft.text = "CTA"
  const clamped = clampInsert(draft, output)
  assert.ok(Math.abs(clamped.start - 9) < 0.05)
  assert.ok(clamped.start > 5.733)
})

test("vídeo sem segmentos continua limitado à duração do arquivo", () => {
  const output = getOutputDuration({
    source: { duration: 5.733, fps: 30 },
  })
  assert.equal(output, 5.733)
  const fitted = fitCaptionLinesToOutput(linesUntil(14.12), output)
  assert.ok(fitted.dropped > 0)
  assert.ok(fitted.lines.every((line) => line.start < 5.733))
  assert.ok(fitted.lines.some((line) => line.start > 4))
})
