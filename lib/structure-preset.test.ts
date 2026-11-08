import { test } from "node:test"
import assert from "node:assert/strict"

import {
  hookVariationFiles,
  hookVariationManifest,
  runHookVariationQueue,
} from "./structure-preset.ts"

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
