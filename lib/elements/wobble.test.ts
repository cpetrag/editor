import assert from "node:assert/strict"
import { test } from "node:test"

import { seedFromId, wobbleEllipse, wobblePolyline } from "./wobble.ts"

test("wobble is stable for the same seed so preview matches export", () => {
  const a = wobbleEllipse(100, 100, 40, seedFromId("el-1"))
  const b = wobbleEllipse(100, 100, 40, seedFromId("el-1"))
  assert.deepEqual(a, b)
  const other = wobbleEllipse(100, 100, 40, seedFromId("el-2"))
  assert.notEqual(a[3]?.x, other[3]?.x)
})

test("wobblePolyline keeps endpoints fixed", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 4 },
    { x: 20, y: 0 },
  ]
  const next = wobblePolyline(points, 9, 3)
  assert.deepEqual(next[0], points[0])
  assert.deepEqual(next[2], points[2])
})
