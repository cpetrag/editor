import { test } from "node:test"
import assert from "node:assert/strict"

import {
  PLAY_H,
  PLAY_W,
  clientToPlay,
  getCanvasDisplayMetrics,
  percentsFromCenter,
  playToClient,
} from "./layout.ts"

test("square host letterboxes the 9:16 play area", () => {
  const metrics = getCanvasDisplayMetrics({ left: 0, top: 0, width: 1080, height: 1080 })
  assert.equal(metrics.displayScale, 1080 / 1920)
  assert.equal(metrics.dispH, 1080)
  assert.ok(Math.abs(metrics.ox - (1080 - metrics.dispW) / 2) < 1e-9)
  assert.equal(metrics.oy, 0)
})

test("clientToPlay ignores clicks in the letterbox", () => {
  const metrics = getCanvasDisplayMetrics({ left: 10, top: 20, width: 1080, height: 1080 })
  const miss = clientToPlay(12, 500, metrics)
  assert.equal(miss.inside, false)
})

test("clientToPlay maps the visible center to 540,960", () => {
  const metrics = getCanvasDisplayMetrics({ left: 0, top: 0, width: 540, height: 960 })
  const hit = clientToPlay(270, 480, metrics)
  assert.equal(hit.inside, true)
  if (!hit.inside) return
  assert.ok(Math.abs(hit.playX - 540) < 0.5)
  assert.ok(Math.abs(hit.playY - 960) < 0.5)
})

test("playToClient is the inverse of clientToPlay on the play area", () => {
  const metrics = getCanvasDisplayMetrics({ left: 40, top: 80, width: 270, height: 480 })
  const screen = playToClient(540, 960, metrics)
  const back = clientToPlay(screen.x, screen.y, metrics)
  assert.equal(back.inside, true)
  if (!back.inside) return
  assert.ok(Math.abs(back.playX - 540) < 0.5)
  assert.ok(Math.abs(back.playY - 960) < 0.5)
})

test("percentsFromCenter round to one decimal and clamp 0-100", () => {
  assert.deepEqual(percentsFromCenter(PLAY_W / 2, PLAY_H / 2), { x: 50, y: 50 })
  assert.deepEqual(percentsFromCenter(0, 0), { x: 0, y: 0 })
  assert.deepEqual(percentsFromCenter(PLAY_W, PLAY_H), { x: 100, y: 100 })
  assert.equal(percentsFromCenter(543.24, 100).x, 50.3)
})
