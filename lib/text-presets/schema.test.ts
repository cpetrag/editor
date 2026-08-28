import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { assertTextPreset, isTextPreset, TEXT_PRESET_SCHEMA } from "./schema.ts"

const dir = join(dirname(fileURLToPath(import.meta.url)), "presets")

test("assertTextPreset accepts every JSON file in presets/", () => {
  const files = readdirSync(dir).filter((name) => name.endsWith(".json"))
  assert.equal(files.length, 10)
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown
    const preset = assertTextPreset(raw)
    assert.equal(preset.schema, TEXT_PRESET_SCHEMA)
    assert.equal(`${preset.id}.json`, file)
  }
})

test("isTextPreset rejects invalid payloads", () => {
  assert.equal(isTextPreset(null), false)
  assert.equal(isTextPreset({}), false)
  assert.throws(() => assertTextPreset({ schema: "nope", id: "x" }))
})
