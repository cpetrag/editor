import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_WATERMARK_PREFS,
  WATERMARK_FONT_PX,
  WATERMARK_MARGIN_PX,
  normalizeWatermarkPrefs,
  watermarkCenter,
  watermarkPaintInput,
  drawWatermark,
} from "./watermark.ts"

const FRAME = { width: 1080, height: 1920 }
const BOX = { width: 120, height: WATERMARK_FONT_PX }
const VISUAL = { opacityPct: 22, fontPx: 42, speed: 1 }

test("normalizeWatermarkPrefs trims, turns newlines into spaces, and caps at 40", () => {
  const parsed = normalizeWatermarkPrefs({ text: "  @loja\nnome  ", loop: false })
  assert.equal(parsed.text, "@loja nome")
  assert.equal(parsed.loop, false)
})

test("normalizeWatermarkPrefs defaults loop to true and empty text on junk", () => {
  assert.deepEqual(normalizeWatermarkPrefs(null), DEFAULT_WATERMARK_PREFS)
  assert.equal(normalizeWatermarkPrefs({ text: "x" }).loop, true)
  assert.equal(normalizeWatermarkPrefs({ text: "   " }).text, "")
  assert.equal(normalizeWatermarkPrefs({ text: "a".repeat(50) }).text.length, 40)
})

test("normalizeWatermarkPrefs fills visual defaults on old { text, loop } JSON", () => {
  const parsed = normalizeWatermarkPrefs({ text: "@a" })
  assert.equal(parsed.text, "@a")
  assert.equal(parsed.loop, true)
  assert.equal(parsed.opacityPct, 22)
  assert.equal(parsed.fontPx, 42)
  assert.equal(parsed.speed, 1)
})

test("normalizeWatermarkPrefs clamps opacity, font and speed", () => {
  assert.equal(normalizeWatermarkPrefs({ opacityPct: 3 }).opacityPct, 8)
  assert.equal(normalizeWatermarkPrefs({ opacityPct: 99 }).opacityPct, 50)
  assert.equal(normalizeWatermarkPrefs({ fontPx: 12.7 }).fontPx, 24)
  assert.equal(normalizeWatermarkPrefs({ speed: 1.1 }).speed, 1)
  assert.equal(normalizeWatermarkPrefs({ speed: 1.2 }).speed, 1.25)
  assert.equal(normalizeWatermarkPrefs({ speed: 0 }).speed, 0.25)
  assert.equal(normalizeWatermarkPrefs({ speed: 9 }).speed, 3)
  assert.equal(normalizeWatermarkPrefs({ opacityPct: "x" }).opacityPct, 22)
})

test("watermarkCenter loop off is bottom-right inside the margin", () => {
  const c = watermarkCenter(0, FRAME, BOX, false)
  assert.equal(c.x, FRAME.width - WATERMARK_MARGIN_PX - BOX.width / 2)
  assert.equal(c.y, FRAME.height - WATERMARK_MARGIN_PX - BOX.height / 2)
})

test("watermarkCenter t=0 loop on matches loop off", () => {
  assert.deepEqual(
    watermarkCenter(0, FRAME, BOX, true),
    watermarkCenter(0, FRAME, BOX, false),
  )
})

test("watermarkCenter stays inside the usable box for several times", () => {
  const minX = WATERMARK_MARGIN_PX + BOX.width / 2
  const maxX = FRAME.width - WATERMARK_MARGIN_PX - BOX.width / 2
  const minY = WATERMARK_MARGIN_PX + BOX.height / 2
  const maxY = FRAME.height - WATERMARK_MARGIN_PX - BOX.height / 2
  for (const t of [0, 1, 10, 100]) {
    const c = watermarkCenter(t, FRAME, BOX, true)
    assert.ok(c.x >= minX - 1e-6 && c.x <= maxX + 1e-6, `x at t=${t}`)
    assert.ok(c.y >= minY - 1e-6 && c.y <= maxY + 1e-6, `y at t=${t}`)
  }
})

test("watermarkCenter speed 2 doubles X displacement before wrap", () => {
  const t = 1
  const c1 = watermarkCenter(t, FRAME, BOX, true, 1)
  const c2 = watermarkCenter(t, FRAME, BOX, true, 2)
  const maxX = FRAME.width - WATERMARK_MARGIN_PX - BOX.width / 2
  assert.equal(maxX - c2.x, 2 * (maxX - c1.x))
})

test("watermarkCenter t=0 with speed 2 is still the static corner", () => {
  assert.deepEqual(
    watermarkCenter(0, FRAME, BOX, true, 2),
    watermarkCenter(0, FRAME, BOX, false),
  )
})

test("watermarkPaintInput is null unless enabled and text exist", () => {
  assert.equal(watermarkPaintInput(true, { text: "", loop: true, ...VISUAL }), null)
  assert.equal(watermarkPaintInput(false, { text: "@loja", loop: true, ...VISUAL }), null)
  assert.deepEqual(watermarkPaintInput(true, { text: "@loja", loop: false, ...VISUAL }), {
    text: "@loja",
    loop: false,
    ...VISUAL,
  })
})

test("drawWatermark with empty text does not call fillText", () => {
  let fills = 0
  const ctx = {
    save() {},
    restore() {},
    measureText: () => ({ width: 10 }),
    fillText: () => {
      fills += 1
    },
    globalAlpha: 1,
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D
  drawWatermark(ctx, 1, FRAME, null)
  drawWatermark(ctx, 1, FRAME, { text: "", loop: true, ...VISUAL })
  assert.equal(fills, 0)
  drawWatermark(ctx, 1, FRAME, { text: "@loja", loop: false, ...VISUAL })
  assert.equal(fills, 1)
})
