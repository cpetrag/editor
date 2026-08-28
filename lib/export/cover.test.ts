import { test } from "node:test"
import assert from "node:assert/strict"

import {
  coverDrawRect,
  evenRenderRect,
  getVideoRect,
  overlayDrawScale,
  transformFromCoverRect,
} from "./cover.ts"

test("coverDrawRect upscales a 576x1024 source onto 1080x1920 without distorting", () => {
  const rect = coverDrawRect(576, 1024, 1080, 1920)
  assert.ok(Math.abs(rect.dw / rect.dh - 576 / 1024) < 1e-9)
  assert.ok(rect.dw >= 1080 - 1e-6)
  assert.ok(rect.dh >= 1920 - 1e-6)
  assert.ok(rect.dx <= 1e-6)
  assert.ok(rect.dy <= 1e-6)
})

test("coverDrawRect crops the excess of a wider source instead of stretching", () => {
  const rect = coverDrawRect(1920, 1080, 1080, 1920)
  assert.ok(Math.abs(rect.dw / rect.dh - 1920 / 1080) < 1e-9)
  assert.ok(rect.dh >= 1920 - 1e-6)
  assert.ok(rect.dx < 0)
})

test("overlayDrawScale maps play height to the export canvas", () => {
  assert.equal(overlayDrawScale(1920, 1920), 1)
  assert.equal(overlayDrawScale(1280, 1920), 1280 / 1920)
  assert.equal(overlayDrawScale(1024, 1920), 1024 / 1920)
})

test("getVideoRect identity 1080x1920 fills the dest", () => {
  const rect = getVideoRect({ scale: 1, x: 0, y: 0 }, 1080, 1920, 1080, 1920)
  assert.ok(Math.abs(rect.dx) < 1e-6)
  assert.ok(Math.abs(rect.dy) < 1e-6)
  assert.ok(Math.abs(rect.dw - 1080) < 1e-6)
  assert.ok(Math.abs(rect.dh - 1920) < 1e-6)
})

test("getVideoRect scale 2 grows from frame center on 9:16", () => {
  const rect = getVideoRect({ scale: 2, x: 0, y: 0 }, 1080, 1920, 1080, 1920)
  assert.ok(Math.abs(rect.dw - 2160) < 1e-6)
  assert.ok(Math.abs(rect.dh - 3840) < 1e-6)
  assert.ok(Math.abs(rect.dx + 540) < 1e-6)
  assert.ok(Math.abs(rect.dy + 960) < 1e-6)
})

test("getVideoRect landscape pan clamps so dest stays covered", () => {
  const left = getVideoRect({ scale: 1, x: 500, y: 0 }, 1920, 1080, 1080, 1920)
  assert.ok(Math.abs(left.dx) < 1e-6)
  assert.ok(left.dx + left.dw >= 1080 - 1e-6)
  const right = getVideoRect({ scale: 1, x: -500, y: 0 }, 1920, 1080, 1080, 1920)
  assert.ok(Math.abs(right.dx - (1080 - right.dw)) < 1e-6)
  assert.ok(right.dx + right.dw >= 1080 - 1e-6)
})

test("getVideoRect taller source pans Y and keeps covering", () => {
  const mid = getVideoRect({ scale: 1, x: 0, y: 0 }, 1080, 2400, 1080, 1920)
  assert.ok(Math.abs(mid.dx) < 1e-6)
  assert.ok(mid.dy < 0)
  const top = getVideoRect({ scale: 1, x: 0, y: 500 }, 1080, 2400, 1080, 1920)
  assert.ok(Math.abs(top.dy) < 1e-6)
  const bottom = getVideoRect({ scale: 1, x: 0, y: -500 }, 1080, 2400, 1080, 1920)
  assert.ok(Math.abs(bottom.dy - (1920 - bottom.dh)) < 1e-6)
})

test("transformFromCoverRect round-trips getVideoRect with center offsets", () => {
  const srcW = 1920
  const srcH = 1080
  const destW = 1080
  const destH = 1920
  const input = { scale: 1.5, x: -8, y: 4 }
  const rect = getVideoRect(input, srcW, srcH, destW, destH)
  const back = transformFromCoverRect(rect, srcW, srcH, destW, destH)
  assert.ok(Math.abs(back.scale - input.scale) < 0.001)
  assert.ok(Math.abs(back.x - input.x) < 0.1)
  assert.ok(Math.abs(back.y - input.y) < 0.1)
  const again = getVideoRect(back, srcW, srcH, destW, destH)
  assert.ok(Math.abs(again.dx - rect.dx) < 1e-6)
  assert.ok(Math.abs(again.dy - rect.dy) < 1e-6)
  assert.ok(Math.abs(again.dw - rect.dw) < 1e-6)
  assert.ok(Math.abs(again.dh - rect.dh) < 1e-6)
})

test("coverDrawRect with sourceWidth 0 returns dest-sized fallback rect", () => {
  const rect = coverDrawRect(0, 1080, 1080, 1920)
  assert.equal(rect.dx, 0)
  assert.equal(rect.dy, 0)
  assert.equal(rect.dw, 1080)
  assert.equal(rect.dh, 1920)
})

test("getVideoRect with scale 0.5 behaves like scale 1", () => {
  const baseline = getVideoRect({ scale: 1, x: 0, y: 0 }, 1080, 1920, 1080, 1920)
  const rect = getVideoRect({ scale: 0.5, x: 0, y: 0 }, 1080, 1920, 1080, 1920)
  assert.ok(Math.abs(rect.dx - baseline.dx) < 1e-6)
  assert.ok(Math.abs(rect.dy - baseline.dy) < 1e-6)
  assert.ok(Math.abs(rect.dw - baseline.dw) < 1e-6)
  assert.ok(Math.abs(rect.dh - baseline.dh) < 1e-6)
})

test("evenRenderRect stays within 1px of getVideoRect for ten framings", () => {
  const vw = 1920
  const vh = 1080
  const cw = 1080
  const ch = 1920
  const cases = [
    { scale: 1, x: 0, y: 0 },
    { scale: 1.5, x: 0, y: 0 },
    { scale: 2, x: -10, y: 5 },
    { scale: 4, x: 0, y: 0 },
    { scale: 1, x: 200, y: 0 },
    { scale: 1.2, x: -80, y: 40 },
    { scale: 3, x: 15, y: -20 },
    { scale: 1, x: 0, y: -200 },
    { scale: 2.5, x: 8.333, y: -2 },
    { scale: 1.001, x: 0.5, y: -0.5 },
  ]
  for (const framing of cases) {
    const preview = getVideoRect(framing, vw, vh, cw, ch)
    const render = evenRenderRect(framing, vw, vh, cw, ch)
    assert.ok(Math.abs(preview.dx - render.dx) <= 1, `dx ${preview.dx} vs ${render.dx}`)
    assert.ok(Math.abs(preview.dy - render.dy) <= 1, `dy ${preview.dy} vs ${render.dy}`)
    assert.ok(Math.abs(preview.dw - render.dw) <= 1, `dw ${preview.dw} vs ${render.dw}`)
    assert.ok(Math.abs(preview.dh - render.dh) <= 1, `dh ${preview.dh} vs ${render.dh}`)
  }
})
