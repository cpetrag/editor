import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DELETE_CONFIRM_ABOVE,
  describeSelection,
  duplicateGroupDelta,
  idsBetween,
  idsTouchingRect,
  marqueeSelection,
  moveTimelineGroup,
  nextClickSelection,
  selectAllItems,
  snapTargetTimes,
  type TimelineItem,
} from "./timeline-selection.ts"

function item(
  id: string,
  start: number,
  duration: number,
  track: TimelineItem["track"] = "captions",
): TimelineItem {
  return { id, start, duration, track, caption: track === "captions" }
}

const captions = [
  item("a", 0, 1),
  item("b", 1, 1),
  item("c", 2, 1),
  item("d", 3, 1),
  item("e", 4, 1),
]

test("clique simples troca a seleção; Ctrl alterna; Shift pega o intervalo da faixa", () => {
  const none = { ids: [] as string[], primaryId: null }
  const first = nextClickSelection(none, "a", captions, { additive: false, range: false })
  assert.deepEqual(first, { ids: ["a"], primaryId: "a" })

  const added = nextClickSelection(first, "c", captions, { additive: true, range: false })
  assert.deepEqual(added, { ids: ["a", "c"], primaryId: "c" })

  const removed = nextClickSelection(added, "a", captions, { additive: true, range: false })
  assert.deepEqual(removed, { ids: ["c"], primaryId: "c" })

  const range = nextClickSelection(
    { ids: ["a"], primaryId: "a" },
    "e",
    captions,
    { additive: false, range: true },
  )
  assert.deepEqual(range.ids, ["a", "b", "c", "d", "e"])
  assert.equal(range.primaryId, "e")
})

test("Shift em outra faixa seleciona só o item clicado", () => {
  const text = item("t", 0, 1, "texts")
  const next = nextClickSelection(
    { ids: ["a"], primaryId: "a" },
    "t",
    [...captions, text],
    { additive: false, range: true },
  )
  assert.deepEqual(next, { ids: ["t"], primaryId: "t" })
})

test("retângulo toca os clipes que cruza, e soma quando é aditivo", () => {
  const hits = idsTouchingRect(
    [
      { id: "a", rect: { left: 0, top: 0, right: 10, bottom: 10 } },
      { id: "b", rect: { left: 12, top: 0, right: 20, bottom: 10 } },
      { id: "c", rect: { left: 40, top: 0, right: 50, bottom: 10 } },
    ],
    { left: 8, top: 2, right: 18, bottom: 12 },
  )
  assert.deepEqual(hits, ["a", "b"])
  const added = marqueeSelection(
    { ids: ["c"], primaryId: "c" },
    hits,
    captions,
    true,
  )
  assert.deepEqual(added.ids, ["c", "a", "b"])
  assert.equal(added.primaryId, "c")
})

test("mover o grupo preserva o espaçamento e para no 0 e no fim", () => {
  const items = [item("a", 1, 1), item("b", 3, 1)]
  const right = moveTimelineGroup({
    items,
    selectedIds: ["a", "b"],
    delta: 2,
    videoDuration: 10,
    snapTolerance: 0,
    snapTargets: [],
  })
  assert.deepEqual(
    right.starts.map((span) => span.start),
    [3, 5],
  )
  const pastEnd = moveTimelineGroup({
    items,
    selectedIds: ["a", "b"],
    delta: 20,
    videoDuration: 10,
    snapTolerance: 0,
    snapTargets: [],
  })
  assert.equal(pastEnd.starts.find((span) => span.id === "b")!.start, 9)
  assert.equal(pastEnd.starts.find((span) => span.id === "a")!.start, 7)
  const pastStart = moveTimelineGroup({
    items,
    selectedIds: ["a", "b"],
    delta: -5,
    videoDuration: 10,
    snapTolerance: 0,
    snapTargets: [],
  })
  assert.equal(pastStart.starts[0]?.start, 0)
  assert.equal(pastStart.starts[1]?.start, 2)
})

test("legenda selecionada não invade legenda de fora, e o snap gruda no cabeçote", () => {
  const items = [item("a", 0, 1), item("b", 2, 1)]
  const blocked = moveTimelineGroup({
    items,
    selectedIds: ["a"],
    delta: 5,
    videoDuration: 10,
    snapTolerance: 0,
    snapTargets: [],
  })
  assert.equal(blocked.starts[0]?.start, 1)

  const snapped = moveTimelineGroup({
    items: [item("a", 0, 1)],
    selectedIds: ["a"],
    delta: 0.9,
    videoDuration: 10,
    snapTolerance: 0.2,
    snapTargets: snapTargetTimes([item("a", 0, 1)], ["a"], 2),
  })
  assert.equal(snapped.guide, 2)
  assert.equal(snapped.starts[0]?.start, 1)
})

test("tolerância zero não gruda", () => {
  const moved = moveTimelineGroup({
    items: [item("a", 0, 1)],
    selectedIds: ["a"],
    delta: 0.9,
    videoDuration: 10,
    snapTolerance: 0,
    snapTargets: [2],
  })
  assert.equal(moved.guide, null)
  assert.equal(moved.starts[0]?.start, 0.9)
})

test("duplicar coloca o grupo depois do último fim", () => {
  const delta = duplicateGroupDelta(captions.slice(0, 2), ["a", "b"], 20)
  assert.equal(delta, 2)
  assert.equal(duplicateGroupDelta([item("a", 0, 10)], ["a"], 10), null)
})

test("Ctrl+A e o resumo contam só as três faixas", () => {
  const mixed = [...captions.slice(0, 2), item("t", 0, 1, "texts"), item("el", 0, 1, "elements")]
  const all = selectAllItems(mixed, "t")
  assert.deepEqual(all.ids, ["a", "el", "t", "b"])
  assert.equal(all.primaryId, "t")
  assert.equal(describeSelection({ captions: 2, texts: 1, elements: 0 }), "3 itens: 2 legendas, 1 texto")
  assert.equal(idsBetween(captions, "a", "e").length, 5)
  assert.equal(DELETE_CONFIRM_ABOVE, 10)
})
