import { test } from "node:test"
import assert from "node:assert/strict"

import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  SCALE_MAX,
  SCALE_MIN,
  type CompositionInsert,
} from "../composition.ts"
import {
  approxBox,
  hitTestOverlays,
  resizePatchForTrack,
  scaleFactorFromDrag,
} from "./hit-test.ts"

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: "texto-livre",
    kind: "text",
    start: 0,
    duration: 3,
    text: "NOVO",
    anchor: "center",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 35,
    fontSize: 56,
    ...patch,
  }
}

function stickerInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "s1",
    type: "sticker-png",
    kind: "sticker",
    start: 0,
    duration: 3,
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 78,
    scale: 0.7,
    sourceKind: "library",
    libraryId: "seta",
    ...patch,
  }
}

function chipInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "c1",
    type: "alerta-desconto",
    start: 0,
    duration: 3,
    text: "50% OFF",
    anchor: "top",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

function captionInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "c1",
    type: "legenda",
    kind: "caption",
    start: 0,
    duration: 3,
    text: "Esse cupom",
    words: [],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 72,
    fontSize: 64,
    ...patch,
  }
}

test("approxBox for text is centered on x/y percent", () => {
  const box = approxBox(textInsert(), 1)
  assert.ok(box)
  assert.ok(Math.abs(box.cx - 540) < 1e-6)
  assert.ok(Math.abs(box.cy - 1920 * 0.35) < 1e-6)
  assert.ok(box.w > 8)
  assert.ok(box.h >= 56 * 1.2)
})

test("approxBox for a short line hugs the word instead of maxWidthPct", () => {
  const box = approxBox(textInsert({ text: "Oi", fontSize: 56, maxWidthPct: 84 }))
  assert.ok(box)
  assert.ok(box.w < 1080 * 0.84 * 0.5)
})

test("approxBox for wrapped text covers every line", () => {
  const box = approxBox(
    textInsert({
      text: "Confira as avaliações incríveis!",
      fontSize: 208,
      maxWidthPct: 84,
    }),
  )
  assert.ok(box)
  assert.ok(box.h > 208 * 1.2 * 2)
})

test("approxBox copies rotation so the selection follows the glyph", () => {
  const box = approxBox(
    textInsert({
      style: {
        fontFamily: "geist",
        fontWeight: 800,
        uppercase: false,
        color: "#fff",
        bgColor: null,
        strokeWidth: 6,
        strokeColor: "#000",
        shadow: "none",
        opacity: 1,
        rotation: 15,
      },
    }),
  )
  assert.ok(box)
  assert.equal(box.rotation, 15)
})

test("approxBox for sticker copies insert.rotation", () => {
  const box = approxBox(stickerInsert({ rotation: 15, scale: 0.7 }))
  assert.equal(box?.rotation, 15)
})

test("approxBox for a placed chip uses percent center and scale", () => {
  const box = approxBox(chipInsert({ x: 50, y: 20, scale: 2 }))
  assert.ok(box)
  assert.ok(Math.abs(box.cx - 540) < 1e-6)
  assert.ok(Math.abs(box.cy - 1920 * 0.2) < 1e-6)
  assert.ok(box.h > 28)
  assert.ok(box.w > 80)
})

test("approxBox for an unplaced chip uses the stacked layout box when given", () => {
  const stacked = { cx: 540, cy: 38, w: 120, h: 28 }
  const box = approxBox(chipInsert(), 1, undefined, stacked)
  assert.deepEqual(box, stacked)
})

test("resizePatchForTrack scales chips like bitmaps and keeps x/y", () => {
  const patch = resizePatchForTrack(chipInsert({ x: 40, y: 10, scale: 1 }), 1.5)
  assert.equal(patch.scale, 1.5)
  assert.equal(patch.x, undefined)
  assert.equal(patch.y, undefined)
  assert.equal(patch.fontSize, undefined)
})

test("hitTestOverlays prefers text over chips", () => {
  const text = textInsert({ id: "front", y: 20, fontSize: 80 })
  const chip = chipInsert({ id: "back", x: 50, y: 20 })
  const box = approxBox(text, 1)
  assert.ok(box)
  const hit = hitTestOverlays([chip, text], box.cx, box.cy, 1)
  assert.equal(hit?.id, "front")
})

test("approxBox for sticker uses scale of frame width", () => {
  const box = approxBox(stickerInsert(), 1, { width: 200, height: 100 })
  assert.ok(box)
  assert.equal(box.w, 1080 * 0.7)
  assert.equal(box.h, 1080 * 0.7 * (100 / 200))
})

test("scaleFactorFromDrag is 1 when the start distance is tiny", () => {
  assert.equal(scaleFactorFromDrag({ x: 10, y: 10 }, { x: 10, y: 10 }, 0.2), 1)
})

test("resizePatchForTrack changes fontSize for text and keeps x/y", () => {
  const patch = resizePatchForTrack(textInsert({ fontSize: 80 }), 2)
  assert.equal(patch.fontSize, 160)
  assert.equal(patch.x, undefined)
  assert.equal(patch.y, undefined)
  assert.equal(patch.scale, undefined)
})

test("resizePatchForTrack clamps fontSize to 40-360", () => {
  assert.equal(resizePatchForTrack(textInsert({ fontSize: 40 }), 0.1).fontSize, FONT_SIZE_MIN)
  assert.equal(resizePatchForTrack(textInsert({ fontSize: 200 }), 10).fontSize, FONT_SIZE_MAX)
})

test("resizePatchForTrack changes scale for stickers with 3 decimals", () => {
  const patch = resizePatchForTrack(stickerInsert({ scale: 0.7 }), 1.5)
  assert.equal(patch.scale, 1.05)
  assert.equal(patch.fontSize, undefined)
})

test("resizePatchForTrack clamps sticker scale to 0.2-4", () => {
  assert.equal(resizePatchForTrack(stickerInsert({ scale: 0.4 }), 0.1).scale, SCALE_MIN)
  assert.equal(resizePatchForTrack(stickerInsert({ scale: 1.5 }), 4).scale, SCALE_MAX)
  assert.equal(SCALE_MIN, 0.2)
  assert.equal(SCALE_MAX, 4)
})

test("hitTestOverlays prefers later text over stickers", () => {
  const text = textInsert({ id: "front", y: 78, fontSize: 80 })
  const sticker = stickerInsert({ id: "back" })
  const box = approxBox(text, 1)
  assert.ok(box)
  const hit = hitTestOverlays([sticker, text], box.cx, box.cy, 1)
  assert.equal(hit?.id, "front")
})

test("approxBox returns a phrase box for caption inserts", () => {
  const box = approxBox(captionInsert())
  assert.ok(box)
  assert.ok((box?.w ?? 0) > 0)
  assert.ok((box?.h ?? 0) > 0)
})

test("resizePatchForTrack changes caption fontSize", () => {
  const patch = resizePatchForTrack(captionInsert({ fontSize: 64 }), 2)
  assert.equal(patch.fontSize, 128)
})

test("hitTestOverlays prefers caption over free text at the same point", () => {
  const caption = captionInsert({ y: 35, text: "LEGENDA" })
  const text = textInsert({ y: 35, text: "TEXTO" })
  const box = approxBox(caption)
  assert.ok(box)
  const hit = hitTestOverlays([text, caption], box!.cx, box!.cy)
  assert.equal(hit?.id, "c1")
})
