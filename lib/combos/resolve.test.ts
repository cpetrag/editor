import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveBeatTime } from "./resolve.ts"
import type { ComboBeat } from "./schema.ts"

function beat(track: ComboBeat["track"], atPct: number, durPct: number): ComboBeat {
  return {
    track,
    atPct,
    durPct,
    kind: "text",
    presetId: "impacto",
    x: 50,
    y: 40,
    scale: 1,
  }
}

test("resolveBeatTime maps gancho to the first 15% of the video", () => {
  const full = resolveBeatTime(beat("gancho", 0, 1), 12)
  assert.equal(full.start, 0)
  assert.equal(full.duration, 12 * 0.15)
  const inner = resolveBeatTime(beat("gancho", 0.1, 0.5), 30)
  assert.equal(inner.start, 30 * 0.15 * 0.1)
  assert.equal(inner.duration, 30 * 0.15 * 0.5)
})

test("resolveBeatTime anchors CTA to the last 30% so 12s and 30s differ", () => {
  const short = resolveBeatTime(beat("cta", 0, 1), 12)
  assert.equal(short.start, 12 * 0.7)
  assert.ok(Math.abs(short.duration - 12 * 0.3) < 1e-9)
  const long = resolveBeatTime(beat("cta", 0, 1), 30)
  assert.equal(long.start, 30 * 0.7)
  assert.equal(long.duration, 30 * 0.3)
})

test("resolveBeatTime uses the 15s preview duration when the video is empty", () => {
  const preview = resolveBeatTime(beat("prova", 0, 1), 0)
  assert.equal(preview.start, 15 * 0.15)
  assert.equal(preview.duration, 15 * 0.55)
})
