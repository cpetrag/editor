import { test } from "node:test"
import assert from "node:assert/strict"

import { PLAY_H, PLAY_W } from "../compose/layout.ts"
import {
  framePxToPercentDelta,
  nudgeTextPercents,
  percentToPlay,
  playToPercent,
} from "./coords.ts"

test("playToPercent e percentToPlay são inversos no centro", () => {
  const percent = playToPercent(PLAY_W / 2, PLAY_H / 2)
  assert.equal(percent.x, 50)
  assert.equal(percent.y, 50)
  const play = percentToPlay(50, 50)
  assert.equal(play.playX, PLAY_W / 2)
  assert.equal(play.playY, PLAY_H / 2)
})

test("framePxToPercentDelta converte 1px de frame em percentuais", () => {
  const delta = framePxToPercentDelta(1, 1)
  assert.ok(Math.abs(delta.x - 100 / PLAY_W) < 1e-9)
  assert.ok(Math.abs(delta.y - 100 / PLAY_H) < 1e-9)
})

test("nudgeTextPercents anda 1px de frame e 10px com Shift", () => {
  const base = { x: 50, y: 50 }
  const one = nudgeTextPercents(base, "ArrowRight", false)
  const ten = nudgeTextPercents(base, "ArrowRight", true)
  assert.ok(Math.abs(one.x - (50 + 100 / PLAY_W)) < 1e-6)
  assert.ok(Math.abs(ten.x - (50 + 1000 / PLAY_W)) < 1e-6)
  assert.equal(one.y, 50)
})

test("nudgeTextPercents não sai de 0..100", () => {
  const left = nudgeTextPercents({ x: 0, y: 0 }, "ArrowLeft", true)
  assert.equal(left.x, 0)
  assert.equal(left.y, 0)
})
