import { test } from "node:test"
import assert from "node:assert/strict"

import {
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  STICKER_INSERT_TYPE,
  TEXT_INSERT_TYPE,
  createDefaultComposition,
  type Composition,
} from "./composition.ts"
import {
  clearInsertsArt,
  newProjectComposition,
  projectFileIds,
} from "./project-reset.ts"

function sample(): Composition {
  const base = createDefaultComposition()
  return {
    ...base,
    source: {
      ...base.source,
      duration: 12,
      fileName: "a.mp4",
      fileId: "vid-1",
    },
    captionStyle: { ...DEFAULT_CAPTION_STYLE, rotation: 15, y: 40 },
    captionPreset: "limpo",
    styleRef: { presetId: "hormozi" },
    inserts: [
      {
        id: "t1",
        type: TEXT_INSERT_TYPE,
        kind: "text",
        start: 0,
        duration: 2,
        anchor: "center",
        animIn: "none",
        animOut: "none",
        text: "oi",
      },
      {
        id: "p1",
        type: STICKER_INSERT_TYPE,
        kind: "sticker",
        start: 1,
        duration: 2,
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
        fileId: "png-1",
      },
      {
        id: "p2",
        type: STICKER_INSERT_TYPE,
        kind: "sticker",
        start: 2,
        duration: 2,
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
        fileId: "png-1",
      },
    ],
  }
}

test("newProjectComposition is empty v4 without fileId or inserts", () => {
  const next = newProjectComposition()
  assert.equal(next.version, COMPOSITION_VERSION)
  assert.equal(next.inserts.length, 0)
  assert.equal(next.source.duration, 0)
  assert.equal(next.source.fileId, undefined)
  assert.equal(next.source.fileName, "")
  assert.equal(next.source.transform, undefined)
})

test("clearInsertsArt keeps the video and resets art", () => {
  const next = clearInsertsArt(sample())
  assert.equal(next.source.fileId, "vid-1")
  assert.equal(next.source.duration, 12)
  assert.equal(next.inserts.length, 0)
  assert.equal(next.captionPreset, "viral")
  assert.equal(next.captionStyle.rotation, 0)
  assert.equal(next.styleRef, undefined)
})

test("clearInsertsArt keeps the video transform", () => {
  const base = sample()
  const withTransform = {
    ...base,
    source: { ...base.source, transform: { scale: 1.8, x: 42, y: 55 } },
  }
  const next = clearInsertsArt(withTransform)
  assert.deepEqual(next.source.transform, { scale: 1.8, x: 42, y: 55 })
  assert.equal(next.inserts.length, 0)
})

test("projectFileIds unique video + stickers + extras", () => {
  const ids = projectFileIds(sample(), ["prev-9", "vid-1", ""])
  assert.deepEqual([...ids].sort(), ["png-1", "prev-9", "vid-1"])
})
