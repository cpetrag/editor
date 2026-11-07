import { test } from "node:test"
import assert from "node:assert/strict"

import {
  hookVariationFiles,
  hookVariationManifest,
  runHookVariationQueue,
  structureTiming,
} from "./structure-preset.ts"

test("structureTiming keeps hook, proof and cta inside a long video", () => {
  const timing = structureTiming(30)
  assert.deepEqual(timing.hook, { start: 0, duration: 2 })
  assert.deepEqual(timing.proof, { start: 2, duration: 2.5 })
  assert.deepEqual(timing.cta, { start: 27, duration: 3 })
  assert.deepEqual(timing.zones, { ganchoEnd: 2, ctaStart: 27 })
  assert.ok(timing.proof.start + timing.proof.duration <= timing.cta.start)
})

test("structureTiming fits an 8s video without overlap or overrun", () => {
  const timing = structureTiming(8)
  assert.deepEqual(timing.hook, { start: 0, duration: 2 })
  assert.deepEqual(timing.proof, { start: 2, duration: 2.5 })
  assert.deepEqual(timing.cta, { start: 5, duration: 3 })
  assert.deepEqual(timing.zones, { ganchoEnd: 2, ctaStart: 5 })
  const end = timing.cta.start + timing.cta.duration
  assert.ok(Math.abs(end - 8) < 1e-6)
  assert.ok(timing.proof.start >= timing.hook.start + timing.hook.duration - 1e-6)
})

test("structureTiming scales videos shorter than the ideal 7.5s", () => {
  const timing = structureTiming(6)
  const ends = [
    timing.hook.start + timing.hook.duration,
    timing.proof.start + timing.proof.duration,
    timing.cta.start + timing.cta.duration,
  ]
  assert.ok(ends[2] !== undefined && Math.abs(ends[2] - 6) < 0.11)
  assert.ok(timing.proof.start >= timing.hook.duration - 1e-6)
  assert.ok(timing.cta.start >= timing.proof.start + timing.proof.duration - 0.11)
})

test("hookVariationFiles and manifest name g1 g2 g3", () => {
  const hooks = ["Primeiro gancho", "Segundo", "Terceiro"]
  assert.deepEqual(
    hookVariationFiles("Calça Flare", hooks).map((item) => item.fileName),
    ["calca-flare_g1.mp4", "calca-flare_g2.mp4", "calca-flare_g3.mp4"],
  )
  assert.deepEqual(hookVariationManifest("Calça Flare", hooks), {
    baseName: "calca-flare",
    variations: [
      { file: "calca-flare_g1.mp4", hook: "Primeiro gancho" },
      { file: "calca-flare_g2.mp4", hook: "Segundo" },
      { file: "calca-flare_g3.mp4", hook: "Terceiro" },
    ],
  })
})

test("runHookVariationQueue continues after a failed job", async () => {
  const seen: string[] = []
  const states = await runHookVariationQueue({
    jobs: [
      { fileName: "a_g1.mp4", hook: "um", run: async () => { seen.push("1") } },
      { fileName: "a_g2.mp4", hook: "dois", run: async () => { throw new Error("render caiu") } },
      { fileName: "a_g3.mp4", hook: "tres", run: async () => { seen.push("3") } },
    ],
  })
  assert.deepEqual(seen, ["1", "3"])
  assert.deepEqual(
    states.map((item) => item.status),
    ["ok", "error", "ok"],
  )
  assert.equal(states[1]?.error, "render caiu")
})
