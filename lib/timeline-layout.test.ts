import { test } from "node:test"
import assert from "node:assert/strict"

import type { Insert } from "./inserts.ts"
import {
  TIMELINE_LANE_HEIGHT,
  clampTimelineZoom,
  clipShowsLabel,
  layoutTimelineTracks,
  scrollLeftForZoom,
  scrollLeftToReveal,
  timelineTrackFor,
} from "./timeline-layout.ts"

function insert(id: string, type: string, start: number, duration: number, kind?: string): Insert {
  return { id, type, start, duration, anchor: "center", ...(kind ? { kind } : {}) } as Insert
}

test("timelineTrackFor sends captions, texts and everything else to their tracks", () => {
  assert.equal(timelineTrackFor(insert("a", "legenda", 0, 1, "caption")), "captions")
  assert.equal(timelineTrackFor(insert("b", "texto-livre", 0, 1)), "texts")
  assert.equal(timelineTrackFor(insert("c", "logo-shopee", 0, 1)), "elements")
})

test("layoutTimelineTracks stacks overlapping clips only inside their own track", () => {
  const layout = layoutTimelineTracks([
    insert("t1", "texto-livre", 0, 3),
    insert("t2", "texto-livre", 1, 3),
    insert("e1", "logo-shopee", 0, 3),
  ])
  assert.deepEqual(
    layout.tracks.map((track) => track.label),
    ["Trechos", "Legendas", "Textos", "Elementos"],
  )
  const texts = layout.tracks.find((track) => track.id === "texts")
  const elements = layout.tracks.find((track) => track.id === "elements")
  assert.equal(texts?.height, TIMELINE_LANE_HEIGHT * 2)
  assert.equal(elements?.height, TIMELINE_LANE_HEIGHT)
  const t1 = layout.clipTops.get("t1") ?? 0
  const t2 = layout.clipTops.get("t2") ?? 0
  assert.equal(t2 - t1, TIMELINE_LANE_HEIGHT)
  assert.ok((layout.clipTops.get("e1") ?? 0) >= (elements?.top ?? 0))
})

test("scrollLeftForZoom keeps the instant under the pointer", () => {
  const next = scrollLeftForZoom({ zoom: 1, nextZoom: 2, scrollLeft: 0, pointerX: 250, viewportWidth: 1000 })
  assert.equal(next, 250)
  assert.equal(
    scrollLeftForZoom({ zoom: 2, nextZoom: 1, scrollLeft: 250, pointerX: 250, viewportWidth: 1000 }),
    0,
  )
})

test("scrollLeftToReveal only scrolls when the playhead leaves the view", () => {
  assert.equal(scrollLeftToReveal({ x: 500, scrollLeft: 0, viewportWidth: 1000 }), 0)
  assert.equal(scrollLeftToReveal({ x: 1500, scrollLeft: 0, viewportWidth: 1000, margin: 20 }), 520)
  assert.equal(scrollLeftToReveal({ x: 100, scrollLeft: 400, viewportWidth: 1000, margin: 20 }), 80)
})

test("clampTimelineZoom and clipShowsLabel guard the edges", () => {
  assert.equal(clampTimelineZoom(0.2), 1)
  assert.equal(clampTimelineZoom(99), 16)
  assert.equal(clampTimelineZoom(Number.NaN), 1)
  assert.equal(clipShowsLabel(10), false)
  assert.equal(clipShowsLabel(80), true)
})
