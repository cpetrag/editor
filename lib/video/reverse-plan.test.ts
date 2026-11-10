import assert from "node:assert/strict"
import { test } from "node:test"

import { reverseChunkPlan, reverseFilterArgs } from "./reverse-plan.ts"

test("vídeo curto inverte de uma vez", () => {
  assert.deepEqual(reverseChunkPlan(5.73), [{ start: 0, end: 5.73 }])
})

test("vídeo longo inverte em blocos de 5 s, do fim para o início", () => {
  const plan = reverseChunkPlan(22)
  assert.deepEqual(plan, [
    { start: 20, end: 22 },
    { start: 15, end: 20 },
    { start: 10, end: 15 },
    { start: 5, end: 10 },
    { start: 0, end: 5 },
  ])
})

test("o filtro reverse tira o áudio e usa libx264", () => {
  const args = reverseFilterArgs("in.mp4", "out.mp4", { start: 1, end: 4 })
  assert.ok(args.includes("reverse"))
  assert.ok(args.includes("-an"))
  assert.ok(args.includes("libx264"))
  assert.equal(args.at(-1), "out.mp4")
})
