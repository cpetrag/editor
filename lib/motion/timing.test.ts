import assert from "node:assert/strict"
import test from "node:test"

import { LEGADO_STYLE } from "../style/presets.ts"
import { selectPack } from "./select.ts"
import {
  clampPhaseFrames,
  enterTotalFrames,
  formatMotionClock,
  framesToSeconds,
  hasCustomTiming,
  motionPhaseLimits,
  secondsToFrames,
} from "./timing.ts"

test("0,30 s e 0,80 s viram 9 e 24 quadros", () => {
  assert.equal(secondsToFrames(0.3), 9)
  assert.equal(secondsToFrames(0.8), 24)
  assert.equal(framesToSeconds(24), 0.8)
  assert.equal(formatMotionClock(24), "0,80 s · 24 f")
})

test("entrada e saída param no que cabe num insert de 3,4 s", () => {
  const exit = secondsToFrames(2)
  const limits = motionPhaseLimits({
    insertSeconds: 3.4,
    enterFrames: secondsToFrames(2),
    delayFrames: 0,
    staggerFrames: 0,
    exitFrames: exit,
    unitCount: 1,
  })
  assert.equal(limits.enterMax, secondsToFrames(3.4) - exit)
  assert.equal(clampPhaseFrames(secondsToFrames(2), limits.enterMax), limits.enterMax)
  assert.equal(limits.tight, true)
  assert.ok(framesToSeconds(limits.enterMax) < 2)
})

test("intervalo de palavra entra na conta do total", () => {
  const total = enterTotalFrames({
    enterFrames: 10,
    delayFrames: 0,
    staggerFrames: 3,
    unitCount: 4,
  })
  assert.equal(total, 10 + 3 * 3)
})

test("tempos diferentes do pack contam como personalizados", () => {
  const defaults = selectPack(LEGADO_STYLE.animation, "cta-seta")
  assert.equal(hasCustomTiming(defaults, defaults), false)
  const slower = {
    ...defaults,
    enter: { ...defaults.enter, durationInFrames: defaults.enter.durationInFrames + 12 },
  }
  assert.equal(hasCustomTiming(slower, defaults), true)
})
