import { test } from "node:test"
import assert from "node:assert/strict"

import {
  estimateBatch,
  findDuplicateGroups,
  insertLabel,
  mergeDuplicateGroup,
  nextInsertStart,
  nextInsertType,
  overflowingInserts,
  seekTimeForInsert,
  sortInsertsByStart,
  retentionZones,
  stackLanes,
  zoneForInsert,
  applyVariationPreview,
} from "./insert-ops.ts"
import type { CompositionInsert as Insert } from "./composition.ts"

function insert(patch: Partial<Insert> & Pick<Insert, "id">): Insert {
  return {
    type: "logo-shopee",
    start: 0,
    duration: 3,
    anchor: "top",
    animIn: "pop",
    animOut: "none",
    ...patch,
  }
}

test("nextInsertStart clamps to the last second of the video", () => {
  assert.equal(nextInsertStart(999, 20.78), 19.78)
  assert.equal(nextInsertStart(5, 20.78), 5)
  assert.equal(nextInsertStart(-1, 20.78), 0)
})

test("nextInsertStart without duration uses the playhead", () => {
  assert.equal(nextInsertStart(4, 0), 4)
})

test("nextInsertType cycles away from the last insert type", () => {
  assert.equal(nextInsertType([]), "logo-shopee")
  assert.equal(
    nextInsertType([insert({ id: "a", type: "logo-shopee" })]),
    "selo-frete",
  )
})

test("nextInsertType ignores overlay inserts when cycling chips", () => {
  assert.equal(
    nextInsertType([
      insert({ id: "a", type: "logo-shopee" }),
      insert({ id: "t", type: "texto-livre", kind: "text", text: "NOVO" }),
    ]),
    "selo-frete",
  )
})

test("applyVariationPreview only remaps chip anchors", () => {
  const text = insert({
    id: "t",
    type: "texto-livre",
    kind: "text",
    text: "NOVO",
    anchor: "center",
    x: 40,
    y: 30,
  })
  const chip = insert({ id: "c", type: "cupom", text: "CUPOM", anchor: "top" })
  const next = applyVariationPreview([chip, text], "bottom")
  assert.equal(next[0]?.anchor, "bottom")
  assert.equal(next[1]?.anchor, "center")
  assert.equal(next[1]?.x, 40)
  assert.equal(next[1]?.y, 30)
})

test("findDuplicateGroups ignores text and sticker overlays", () => {
  const groups = findDuplicateGroups([
    insert({ id: "t1", type: "texto-livre", kind: "text", text: "NOVO" }),
    insert({ id: "t2", type: "texto-livre", kind: "text", text: "NOVO" }),
  ])
  assert.equal(groups.length, 0)
})

test("insertLabel prefers the content text", () => {
  assert.equal(insertLabel(insert({ id: "a", text: "Restam 3", type: "barra-estoque" })), "Restam 3")
  assert.equal(insertLabel(insert({ id: "b" })), "Logo Shopee")
})

test("findDuplicateGroups reports identical stacked inserts", () => {
  const groups = findDuplicateGroups([
    insert({ id: "a" }),
    insert({ id: "b" }),
    insert({ id: "c", start: 6, type: "alerta-desconto", text: "50% OFF" }),
  ])
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0]?.ids.sort(), ["a", "b"])
})

test("mergeDuplicateGroup keeps the first id", () => {
  const merged = mergeDuplicateGroup(
    [insert({ id: "a" }), insert({ id: "b" }), insert({ id: "c", start: 4 })],
    ["a", "b"],
  )
  assert.deepEqual(merged.map((item) => item.id), ["a", "c"])
})

test("zoneForInsert uses the midpoint against contiguous proportional zones", () => {
  assert.equal(zoneForInsert(insert({ id: "g", start: 0.5 }), 20), "gancho")
  assert.equal(zoneForInsert(insert({ id: "p", start: 4 }), 20), "prova")
  assert.equal(zoneForInsert(insert({ id: "c", start: 16 }), 20), "cta")
})

test("zoneForInsert puts a mid-video insert in prova, not cta", () => {
  assert.equal(
    zoneForInsert(insert({ id: "mid", start: 9, duration: 3 }), 18.088),
    "prova",
  )
})

test("retentionZones cover the full duration without gaps or overlap", () => {
  for (const total of [10, 18.088, 20]) {
    const zones = retentionZones(total)
    assert.equal(zones[0]?.from, 0)
    assert.equal(zones[zones.length - 1]?.to, total)
    for (let i = 0; i < zones.length - 1; i += 1) {
      const current = zones[i]
      const next = zones[i + 1]
      assert.ok(current && next)
      assert.equal(current.to, next.from)
      assert.ok(current.to > current.from)
    }
  }
})

test("sortInsertsByStart is flat and stable by start then id", () => {
  const sorted = sortInsertsByStart([
    insert({ id: "b", start: 2.6 }),
    insert({ id: "a", start: 0.5 }),
    insert({ id: "c", start: 2.6, type: "texto-livre" }),
  ])
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["a", "b", "c"],
  )
})

test("overflowingInserts ignores a single frame of rounding", () => {
  const overflow = overflowingInserts(
    [insert({ id: "edge", start: 11.9, duration: 3 })],
    14.899,
    30,
  )
  assert.deepEqual(overflow.map((item) => item.id), [])
})

test("overflowingInserts lists inserts past the video end", () => {
  const overflow = overflowingInserts(
    [insert({ id: "ok", start: 1, duration: 3 }), insert({ id: "bad", start: 19, duration: 4 })],
    20.78,
  )
  assert.deepEqual(overflow.map((item) => item.id), ["bad"])
})

test("estimateBatch scales time and size with variation count", () => {
  assert.deepEqual(estimateBatch(21), { seconds: 168, megabytes: 105 })
})

test("seekTimeForInsert só move o playhead quando está fora da janela", () => {
  const clip = insert({ id: "t", start: 2.6, duration: 3 })
  assert.equal(seekTimeForInsert(0.02, clip), 2.6)
  assert.equal(seekTimeForInsert(2.6, clip), null)
  assert.equal(seekTimeForInsert(4, clip), null)
  assert.equal(seekTimeForInsert(5.6, clip), 2.6)
})

test("stackLanes puts overlapping inserts on different rows", () => {
  const lanes = stackLanes([
    insert({ id: "a", start: 0, duration: 3 }),
    insert({ id: "b", start: 0, duration: 3 }),
    insert({ id: "c", start: 10, duration: 2 }),
  ])
  assert.notEqual(lanes.get("a"), lanes.get("b"))
  assert.equal(lanes.get("c"), 0)
})
