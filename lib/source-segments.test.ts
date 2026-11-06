import { test } from "node:test"
import assert from "node:assert/strict"

import {
  applySegmentedFraming,
  canSplitSourceAt,
  clampSourceCuts,
  clearSegmentTransforms,
  hasAnySegmentTransform,
  listSourceSegments,
  parseSourceCuts,
  removeSourceCut,
  segmentIndexAt,
  serializeSourceCuts,
  setSegmentTransformAt,
  sourceTransformAt,
  splitSourceAt,
  type SegmentedFraming,
} from "./source-segments.ts"

const zoomed = { scale: 1.5, x: 0, y: 0 }
const closeUp = { scale: 2, x: -10, y: 5 }

test("segmentIndexAt: a divisão pertence ao trecho que ela abre", () => {
  const cuts = [{ time: 3 }, { time: 7 }]
  assert.equal(segmentIndexAt(undefined, 5), 0)
  assert.equal(segmentIndexAt(cuts, 2.99), 0)
  assert.equal(segmentIndexAt(cuts, 3), 1)
  assert.equal(segmentIndexAt(cuts, 7.5), 2)
})

test("segmentIndexAt ignora lista inválida vinda do JSON", () => {
  assert.equal(segmentIndexAt("lixo" as unknown as [], 5), 0)
})

test("sourceTransformAt usa o transform base antes da primeira divisão", () => {
  const framing: SegmentedFraming = {
    transform: zoomed,
    cuts: [{ time: 4, transform: closeUp }, { time: 8 }],
  }
  assert.deepEqual(sourceTransformAt(framing, 1), zoomed)
  assert.deepEqual(sourceTransformAt(framing, 5), closeUp)
  assert.equal(sourceTransformAt(framing, 9), undefined)
})

test("splitSourceAt herda o zoom do trecho dividido e mantém a ordem", () => {
  const framing: SegmentedFraming = { transform: zoomed, cuts: [{ time: 8, transform: closeUp }] }
  assert.deepEqual(splitSourceAt(framing, 4.123, 12), [
    { time: 4.12, transform: zoomed },
    { time: 8, transform: closeUp },
  ])
  assert.deepEqual(splitSourceAt(framing, 10, 12), [
    { time: 8, transform: closeUp },
    { time: 10, transform: closeUp },
  ])
})

test("splitSourceAt recusa trecho curto demais ou colado na ponta", () => {
  const framing: SegmentedFraming = { cuts: [{ time: 5 }] }
  assert.equal(splitSourceAt(framing, 0.1, 10), null)
  assert.equal(splitSourceAt(framing, 9.9, 10), null)
  assert.equal(splitSourceAt(framing, 5.2, 10), null)
  assert.equal(canSplitSourceAt(framing, 5.2, 10), false)
  assert.equal(canSplitSourceAt(framing, 6, 10), true)
})

test("setSegmentTransformAt edita só o trecho do instante e limpa identidade", () => {
  const framing: SegmentedFraming = { transform: zoomed, cuts: [{ time: 4 }, { time: 8 }] }
  const middle = setSegmentTransformAt(framing, 5, closeUp)
  assert.deepEqual(middle, {
    transform: zoomed,
    cuts: [{ time: 4, transform: closeUp }, { time: 8 }],
  })
  const first = setSegmentTransformAt(middle, 1, { scale: 1, x: 0, y: 0 })
  assert.equal(first.transform, undefined)
  assert.deepEqual(first.cuts, middle.cuts)
})

test("removeSourceCut junta trechos e some com a lista vazia", () => {
  const cuts = [{ time: 4, transform: closeUp }, { time: 8 }]
  assert.deepEqual(removeSourceCut(cuts, 0), [{ time: 8 }])
  assert.equal(removeSourceCut([{ time: 4 }], 0), undefined)
})

test("listSourceSegments cobre o vídeo inteiro com o zoom de cada trecho", () => {
  const segments = listSourceSegments(
    { transform: zoomed, cuts: [{ time: 4, transform: closeUp }] },
    10,
  )
  assert.deepEqual(segments, [
    { index: 0, start: 0, end: 4, transform: zoomed },
    { index: 1, start: 4, end: 10, transform: closeUp },
  ])
})

test("clampSourceCuts descarta divisões fora do vídeo e preserva identidade", () => {
  const valid = [{ time: 2 }, { time: 6 }]
  assert.equal(clampSourceCuts(valid, 10), valid)
  assert.deepEqual(clampSourceCuts([{ time: 9 }, { time: 2 }, { time: 2.1 }, { time: 12 }], 10), [
    { time: 2 },
    { time: 9 },
  ])
  assert.equal(clampSourceCuts([{ time: 12 }], 10), undefined)
})

test("parseSourceCuts + serializeSourceCuts fazem round-trip", () => {
  const cuts = [{ time: 6, transform: closeUp }, { time: 3 }]
  const json = JSON.parse(JSON.stringify(serializeSourceCuts(cuts)))
  assert.deepEqual(parseSourceCuts(json, 10, 0, 0), [{ time: 3 }, { time: 6, transform: closeUp }])
  assert.equal(parseSourceCuts("nope", 10, 0, 0), undefined)
  assert.deepEqual(parseSourceCuts([{ time: -1 }, { foo: 1 }, { time: 4 }], 10, 0, 0), [{ time: 4 }])
})

test("clearSegmentTransforms mantém as divisões e zera os zooms", () => {
  const framing: SegmentedFraming = { transform: zoomed, cuts: [{ time: 4, transform: closeUp }] }
  assert.equal(hasAnySegmentTransform(framing), true)
  const cleared = clearSegmentTransforms(framing)
  assert.deepEqual(cleared, { cuts: [{ time: 4 }] })
  assert.equal(hasAnySegmentTransform(cleared), false)
})

test("applySegmentedFraming remove chaves vazias da source", () => {
  const source = { fileName: "a.mp4", transform: zoomed, cuts: [{ time: 4 }] }
  assert.deepEqual(applySegmentedFraming(source, { cuts: [] }), { fileName: "a.mp4" })
  assert.deepEqual(applySegmentedFraming(source, { transform: closeUp, cuts: [{ time: 2 }] }), {
    fileName: "a.mp4",
    transform: closeUp,
    cuts: [{ time: 2 }],
  })
})
