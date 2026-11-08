import { test } from "node:test"
import assert from "node:assert/strict"

import {
  angleDegFromCenter,
  rotationFromDrag,
  localPoint,
  maxWidthPctFromEdgeDrag,
  scaleFromCornerDrag,
} from "./preview-handles.ts"

test("angleDegFromCenter: leste = 0, sul = 90 (Y para baixo)", () => {
  assert.equal(angleDegFromCenter({ x: 0, y: 0 }, { x: 10, y: 0 }), 0)
  assert.equal(angleDegFromCenter({ x: 0, y: 0 }, { x: 0, y: 10 }), 90)
})

test("rotationFromDrag soma o delta e unwrap de ±180", () => {
  assert.equal(rotationFromDrag(10, 0, 45), 55)
  const crossed = rotationFromDrag(0, 170, -170)
  assert.ok(Math.abs(crossed - 20) < 1e-6)
})

test("maxWidthPctFromEdgeDrag: E aumenta com +localX; W com −localX; clampa 20–100", () => {
  assert.equal(maxWidthPctFromEdgeDrag(50, 54, 1080, "e"), 60)
  assert.equal(maxWidthPctFromEdgeDrag(50, -54, 1080, "w"), 60)
  assert.equal(maxWidthPctFromEdgeDrag(84, 5000, 1080, "e"), 100)
  assert.equal(maxWidthPctFromEdgeDrag(30, -5000, 1080, "e"), 20)
})

test("canto +60 px na diagonal aumenta a escala e não passa de 4", () => {
  const halfW = 80
  const halfH = 40
  const startDist = Math.hypot(halfW, halfH)
  const nowDist = Math.hypot(halfW + 60, halfH + 60)
  const scale = scaleFromCornerDrag(1, startDist, nowDist)
  assert.ok(scale > 1)
  assert.ok(scale <= 4)
  assert.equal(scaleFromCornerDrag(1, startDist, startDist * 20), 4)
  assert.equal(scaleFromCornerDrag(1, startDist, startDist * 0.01), 0.3)
})

test("localPoint desfaz a rotação da caixa", () => {
  const p = localPoint({ x: 0, y: 0 }, { x: 0, y: 10 }, 90)
  assert.ok(Math.abs(p.x - 10) < 1e-6)
  assert.ok(Math.abs(p.y) < 1e-6)
})
