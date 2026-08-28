import assert from "node:assert/strict"
import { test } from "node:test"

import { createProgressHub, nextProgress } from "./progress.ts"

test("nextProgress nunca anda para trás e fica entre 0 e 1", () => {
  assert.equal(nextProgress(0.4, 0.2), 0.4)
  assert.equal(nextProgress(0.4, 0.7), 0.7)
  assert.equal(nextProgress(0.9, 1.4), 1)
  assert.equal(nextProgress(0, -0.2), 0)
})

test("hub emite progresso monotônico e reenvia o último valor para quem entra tarde", () => {
  const hub = createProgressHub()
  const seen: Array<{ progress: number; stage: string }> = []

  hub.emit("job-1", { progress: 0.5, stage: "rendering" })
  const unsubscribe = hub.subscribe("job-1", (event) => seen.push(event))
  hub.emit("job-1", { progress: 0.2, stage: "rendering" })
  hub.emit("job-1", { progress: 1, stage: "done" })
  unsubscribe()

  assert.deepEqual(seen, [
    { progress: 0.5, stage: "rendering" },
    { progress: 0.5, stage: "rendering" },
    { progress: 1, stage: "done" },
  ])
})
