import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import {
  TEXT_PRESET_IDS,
  TEXT_PRESETS,
  getTextPreset,
  isTextPresetId,
  textPresetsInGroup,
} from "./catalog.ts"
import { assertTextPreset } from "./schema.ts"

const dir = join(dirname(fileURLToPath(import.meta.url)), "presets")

test("catalog has 10 unique presets matching the JSON files", () => {
  assert.equal(TEXT_PRESETS.length, 10)
  assert.equal(new Set(TEXT_PRESETS.map((preset) => preset.id)).size, 10)
  for (const id of TEXT_PRESET_IDS) {
    const fromDisk = assertTextPreset(
      JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")) as unknown,
    )
    const fromCatalog = getTextPreset(id)
    assert.equal(fromCatalog.id, fromDisk.id)
    assert.equal(fromCatalog.name, fromDisk.name)
    assert.equal(fromCatalog.font.family, fromDisk.font.family)
    assert.equal(fromCatalog.size.ratio, fromDisk.size.ratio)
  }
})

test("isTextPresetId and groups", () => {
  assert.equal(isTextPresetId("impacto"), true)
  assert.equal(isTextPresetId("bold-outline"), false)
  assert.ok(textPresetsInGroup("impacto").length >= 1)
  assert.ok(textPresetsInGroup("destaque").length >= 1)
  assert.ok(textPresetsInGroup("apoio").length >= 1)
})
