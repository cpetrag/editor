import { test } from "node:test"
import assert from "node:assert/strict"

import { PLAY_H, PLAY_W } from "./layout.ts"
import { nudgePercents, snapMoveCenter } from "./preview-snap.ts"

test("nudgePercents moves one percent, five with shift, and clamps", () => {
  assert.deepEqual(nudgePercents({ x: 50, y: 50 }, "ArrowLeft", false), { x: 49, y: 50 })
  assert.deepEqual(nudgePercents({ x: 50, y: 50 }, "ArrowUp", true), { x: 50, y: 45 })
  assert.deepEqual(nudgePercents({ x: 0, y: 100 }, "ArrowLeft", false), { x: 0, y: 100 })
  assert.deepEqual(nudgePercents({ x: 99, y: 0 }, "ArrowRight", true), { x: 100, y: 0 })
})

test("snapMoveCenter sticks to the frame midpoint within canvas tolerance", () => {
  const snapped = snapMoveCenter(PLAY_W / 2 + 4, PLAY_H / 2 - 3, [], 8)
  assert.ok(Math.abs(snapped.cx - PLAY_W / 2) < 1e-6)
  assert.ok(Math.abs(snapped.cy - PLAY_H / 2) < 1e-6)
})

test("snapMoveCenter does not snap when the gap is larger than tolerance", () => {
  const snapped = snapMoveCenter(100, 200, [], 8)
  assert.equal(snapped.cx, 100)
  assert.equal(snapped.cy, 200)
})
