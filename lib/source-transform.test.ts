import { test } from "node:test"
import assert from "node:assert/strict"

import { getVideoRect } from "./export/cover.ts"
import {
  DEFAULT_SOURCE_TRANSFORM,
  clampSourceTransform,
  isIdentitySourceTransform,
  nudgeSourceTransform,
  panSourceTransform,
  parseSourceTransform,
  scaleSourceTransform,
  scaleSourceTransformAt,
  snapFramingToCenter,
  sourceTransformOrDefault,
} from "./source-transform.ts"

test("parseSourceTransform omits identity in offset space and legacy anchor 50/50", () => {
  assert.equal(parseSourceTransform(undefined), undefined)
  assert.equal(parseSourceTransform("nope"), undefined)
  assert.equal(parseSourceTransform({ scale: 1, x: 0, y: 0, space: "offset" }), undefined)
  assert.equal(parseSourceTransform({ scale: 1, x: 50, y: 50 }, 1080, 1920), undefined)
})

test("parseSourceTransform offset space keeps center offsets and clamps scale", () => {
  const parsed = parseSourceTransform({ scale: 0, x: -10, y: 8, extra: 1, space: "offset" })
  assert.deepEqual(parsed, { scale: 1, x: -10, y: 8 })
  const zoom = parseSourceTransform({ scale: 9, x: -8, y: 4, space: "offset" }, 1920, 1080)
  assert.equal(zoom?.scale, 4)
})

test("parseSourceTransform migrates legacy source-point anchors to center offsets", () => {
  const next = parseSourceTransform({ scale: 1, x: 0, y: 50 }, 1920, 1080)
  assert.ok(next)
  const rect = getVideoRect(next, 1920, 1080, 1080, 1920)
  assert.ok(Math.abs(rect.dx) < 1e-6)
  assert.ok(rect.dx + rect.dw >= 1080 - 1e-6)
})

test("isIdentitySourceTransform matches default", () => {
  assert.equal(isIdentitySourceTransform(DEFAULT_SOURCE_TRANSFORM), true)
  assert.equal(isIdentitySourceTransform({ scale: 1.001, x: 0, y: 0 }), false)
})

test("panSourceTransform positive dx increases x and stays covering", () => {
  const start = { scale: 1, x: 0, y: 0 }
  const next = panSourceTransform(start, 200, 0, 1920, 1080)
  assert.ok(next.x > 0)
  const rect = getVideoRect(next, 1920, 1080, 1080, 1920)
  assert.ok(rect.dx <= 1e-6)
  assert.ok(rect.dx + rect.dw >= 1080 - 1e-6)
})

test("scaleSourceTransform keeps x/y at center", () => {
  const next = scaleSourceTransform({ scale: 1, x: 0, y: 0 }, 2, 1080, 1920)
  assert.equal(next.scale, 2)
  assert.equal(next.x, 0)
  assert.equal(next.y, 0)
})

test("clampSourceTransform without source size only clamps scale", () => {
  const next = clampSourceTransform({ scale: 8, x: -4, y: 140 }, 0, 0)
  assert.deepEqual(next, { scale: 4, x: -4, y: 140 })
})

test("sourceTransformOrDefault fills identity", () => {
  assert.deepEqual(sourceTransformOrDefault(undefined), DEFAULT_SOURCE_TRANSFORM)
})

test("parseSourceTransform partial scale defaults x/y to 0 in offset space", () => {
  assert.deepEqual(parseSourceTransform({ scale: 2, space: "offset" }), { scale: 2, x: 0, y: 0 })
})

test("scaleSourceTransform clamps scale to max 4", () => {
  const next = scaleSourceTransform({ scale: 3, x: 0, y: 0 }, 2, 1080, 1920)
  assert.equal(next.scale, 4)
})

test("clampSourceTransform with source size keeps cover rect covering", () => {
  const result = clampSourceTransform({ scale: 1, x: -500, y: 0 }, 1920, 1080)
  const rect = getVideoRect(result, 1920, 1080, 1080, 1920)
  assert.ok(rect.dx <= 1e-6)
  assert.ok(rect.dx + rect.dw >= 1080 - 1e-6)
})

test("scaleSourceTransformAt keeps the pivot canvas point stable", () => {
  const start = { scale: 1.5, x: -6, y: 3 }
  const pivot = { x: 400, y: 900 }
  const before = getVideoRect(start, 1920, 1080, 1080, 1920)
  const u = (pivot.x - before.dx) / before.dw
  const v = (pivot.y - before.dy) / before.dh
  const next = scaleSourceTransformAt(start, 1.2, pivot, 1920, 1080)
  const after = getVideoRect(next, 1920, 1080, 1080, 1920)
  assert.ok(Math.abs(after.dx + u * after.dw - pivot.x) < 1.5)
  assert.ok(Math.abs(after.dy + v * after.dh - pivot.y) < 1.5)
})

test("nudgeSourceTransform moves one canvas pixel", () => {
  const next = nudgeSourceTransform({ scale: 2, x: 0, y: 0 }, "ArrowRight", false, 1080, 1920)
  assert.ok(Math.abs(next.x - 100 / 1080) < 0.002)
})

test("snapFramingToCenter pins near-zero offsets", () => {
  const snapped = snapFramingToCenter({ scale: 1.2, x: 0.4, y: -0.5 }, false)
  assert.equal(snapped.x, 0)
  assert.equal(snapped.y, 0)
  const kept = snapFramingToCenter({ scale: 1.2, x: 0.4, y: -0.5 }, true)
  assert.equal(kept.x, 0.4)
})
