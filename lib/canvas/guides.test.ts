import { test } from "node:test"
import assert from "node:assert/strict"

import { PLAY_H, PLAY_W } from "../compose/layout.ts"
import { SAFE_INSET_RATIO, snapMoveWithGuides } from "./guides.ts"

test("snapMoveWithGuides gruda no centro do frame e reporta a guia", () => {
  const snapped = snapMoveWithGuides(PLAY_W / 2 + 4, PLAY_H / 2 - 3, [], 8)
  assert.ok(Math.abs(snapped.cx - PLAY_W / 2) < 1e-6)
  assert.ok(Math.abs(snapped.cy - PLAY_H / 2) < 1e-6)
  assert.equal(snapped.guides.x, PLAY_W / 2)
  assert.equal(snapped.guides.y, PLAY_H / 2)
})

test("snapMoveWithGuides gruda na safe area 6% / 94%", () => {
  const safeX = PLAY_W * SAFE_INSET_RATIO
  const safeY = PLAY_H * (1 - SAFE_INSET_RATIO)
  const snapped = snapMoveWithGuides(safeX + 3, safeY - 2, [], 8)
  assert.ok(Math.abs(snapped.cx - safeX) < 1e-6)
  assert.ok(Math.abs(snapped.cy - safeY) < 1e-6)
  assert.equal(snapped.guides.x, safeX)
  assert.equal(snapped.guides.y, safeY)
})

test("snapMoveWithGuides não mostra guia quando o vão é maior que a tolerância", () => {
  const snapped = snapMoveWithGuides(100, 200, [], 8)
  assert.equal(snapped.cx, 100)
  assert.equal(snapped.cy, 200)
  assert.equal(snapped.guides.x, null)
  assert.equal(snapped.guides.y, null)
})
