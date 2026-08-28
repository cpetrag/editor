import { test } from "node:test"
import assert from "node:assert/strict"

import { FACTORY_PRESET_IDS, LEGADO_PRESET_ID, getPresetStyle } from "./presets.ts"
import { resolveStyle } from "./resolve-style.ts"
import {
  USER_PRESET_FILE_VERSION,
  allocateUserPresetId,
  canWritePresetId,
  createUserPreset,
  parseUserPresetFile,
  presetsUsedInComposition,
  serializeUserPresetFile,
  setExtraPresets,
} from "./user-presets.ts"
import { createMemoryPresetStore } from "./preset-store.ts"
import { applyFactoryPreset, captionStyleChips, chipsForContext } from "../style-preset.ts"
import type { UserPreset } from "./types.ts"
import { LEGADO_STYLE } from "./presets.ts"
import {
  COMPOSITION_VERSION,
  DEFAULT_CAPTION_STYLE,
  parseComposition,
  serializeComposition,
} from "../composition.ts"

function sampleUser(patch: Partial<UserPreset> = {}): UserPreset {
  return createUserPreset({
    label: "Meu Hormozi",
    group: "legenda",
    style: {
      ...LEGADO_STYLE,
      text: { ...LEGADO_STYLE.text, fontFamily: "montserrat", fontSize: 92, color: "#FFE600" },
    },
    ...patch,
  })
}

test("id de preset do usuário nunca colide com fábrica ou legado", () => {
  const ids = new Set(Array.from({ length: 20 }, () => allocateUserPresetId()))
  assert.equal(ids.size, 20)
  for (const id of ids) {
    assert.equal(canWritePresetId(id), true)
    assert.ok(id.startsWith("meu_"))
    assert.ok(!(FACTORY_PRESET_IDS as readonly string[]).includes(id))
    assert.notEqual(id, LEGADO_PRESET_ID)
  }
  assert.equal(canWritePresetId("hormozi"), false)
  assert.equal(canWritePresetId("legado"), false)
})

test("createUserPreset recusa sobrescrever fábrica", () => {
  assert.throws(() =>
    createUserPreset({
      id: "hormozi",
      label: "Hack",
      group: "legenda",
      style: LEGADO_STYLE,
    }),
  )
})

test("exportar e importar JSON reproduz o estilo idêntico", () => {
  const original = sampleUser()
  const json = serializeUserPresetFile([original])
  const parsed = JSON.parse(json) as { version?: number }
  assert.equal(parsed.version, USER_PRESET_FILE_VERSION)
  const [imported] = parseUserPresetFile(json)
  assert.ok(imported)
  assert.equal(imported.id, original.id)
  assert.equal(imported.label, original.label)
  assert.equal(imported.group, original.group)
  assert.deepEqual(imported.style, original.style)
})

test("importar JSON ignora ids de fábrica e não os sobrescreve", () => {
  const mine = sampleUser()
  const raw = JSON.stringify({
    version: 1,
    presets: [
      { ...mine, id: "hormozi", label: "Falso Hormozi" },
      mine,
    ],
  })
  const imported = parseUserPresetFile(raw)
  assert.equal(imported.length, 1)
  assert.equal(imported[0]?.id, mine.id)
  assert.equal(getPresetStyle("hormozi").text.fontFamily, "montserrat")
})

test("preset apagado cai no legado + overrides, sem quebrar o insert", () => {
  const mine = sampleUser()
  setExtraPresets([mine])
  try {
    const withCatalog = resolveStyle(
      { styleRef: { presetId: mine.id, overrides: { text: { rotation: 8 } } } },
      null,
      {},
    )
    assert.equal(withCatalog.text.fontFamily, "montserrat")
    assert.equal(withCatalog.text.fontSize, 92)
    assert.equal(withCatalog.text.rotation, 8)
  } finally {
    setExtraPresets([])
  }

  const afterDelete = resolveStyle(
    { styleRef: { presetId: mine.id, overrides: { text: { rotation: 8, color: "#ABC" } } } },
    null,
    {},
  )
  assert.equal(afterDelete.text.fontFamily, "geist")
  assert.equal(afterDelete.text.fontSize, 56)
  assert.equal(afterDelete.text.rotation, 8)
  assert.equal(afterDelete.text.color, "#ABC")
})

test("memory store grava, lista, apaga e recusa fábrica", async () => {
  const store = createMemoryPresetStore()
  const mine = sampleUser({ label: "CTA quente", group: "cta" })
  await store.save(mine)
  const listed = await store.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.label, "CTA quente")
  await assert.rejects(() => store.save({ ...mine, id: "carrinhoLaranja" }))
  await store.delete(mine.id)
  assert.equal((await store.list()).length, 0)
})

test("chips incluem presets meus com badge no grupo da faixa", () => {
  const mine = sampleUser({ group: "cta", label: "Meu CTA" })
  const caption = {
    id: "c1",
    type: "legenda" as const,
    kind: "caption" as const,
    start: 0,
    duration: 2,
    text: "oi",
    anchor: "bottom" as const,
    animIn: "none" as const,
    animOut: "none" as const,
  }
  const legend = chipsForContext(caption, 20, [mine])
  assert.deepEqual(legend, [])

  const ctaInsert = {
    id: "t1",
    type: "texto-livre" as const,
    kind: "text" as const,
    start: 16,
    duration: 3,
    text: "Comprar",
    anchor: "center" as const,
    animIn: "none" as const,
    animOut: "none" as const,
  }
  const cta = chipsForContext(ctaInsert, 20, [mine])
  const own = cta.find((chip) => chip.id === mine.id)
  assert.ok(own)
  assert.equal(own.mine, true)
  assert.equal(own.label, "Meu CTA")
  assert.ok(!cta.some((chip) => chip.id === "hormozi"))

  const captionMine = sampleUser({ group: "legenda", label: "Minha legenda" })
  const captionChips = captionStyleChips([captionMine])
  assert.ok(captionChips.some((chip) => chip.id === captionMine.id && chip.mine))
})

test("aplicar preset do usuário carimba o styleRef", () => {
  const mine = sampleUser()
  setExtraPresets([mine])
  try {
    const inserts = [
      {
        id: "c1",
        type: "legenda" as const,
        kind: "caption" as const,
        start: 0,
        duration: 2,
        text: "oi",
        anchor: "bottom" as const,
        animIn: "none" as const,
        animOut: "none" as const,
      },
    ]
    const next = applyFactoryPreset(inserts, mine.id, {
      selectedId: "c1",
      videoDuration: 20,
      catalog: { [mine.id]: mine },
    })
    assert.equal(next[0]?.styleRef?.presetId, mine.id)
  } finally {
    setExtraPresets([])
  }
})

test("composição serializa customPresets e reabre o estilo", () => {
  const mine = sampleUser()
  const json = serializeComposition({
    version: COMPOSITION_VERSION,
    source: {
      duration: 12,
      fps: 30,
      width: 1080,
      height: 1920,
      fileName: "base.mp4",
    },
    brand: { fontId: "geist", primary: "#EE4D2D", logo: "" },
    inserts: [
      {
        id: "c1",
        type: "legenda",
        kind: "caption",
        start: 0,
        duration: 2,
        text: "oi",
        anchor: "bottom",
        animIn: "none",
        animOut: "none",
        styleRef: { presetId: mine.id, overrides: {} },
      },
    ],
    batch: { hooks: [], fonts: ["geist"], positions: ["top"], baseName: "" },
    output: { width: 1080, height: 1920, fps: 30, videoBitrate: 8_000_000 },
    captionPreset: "viral",
    captionStyle: DEFAULT_CAPTION_STYLE,
    customPresets: { [mine.id]: mine },
  })
  const loaded = parseComposition(JSON.parse(json) as unknown)
  assert.equal(loaded.customPresets?.[mine.id]?.style.text.fontSize, 92)
  assert.equal(loaded.inserts[0]?.styleRef?.presetId, mine.id)
})

test("presetsUsedInComposition lista só os custom em uso", () => {
  const mine = sampleUser()
  const unused = sampleUser({ label: "Folga" })
  const used = presetsUsedInComposition(
    {
      inserts: [
        {
          styleRef: { presetId: mine.id, overrides: {} },
        },
        {
          styleRef: { presetId: "hormozi", overrides: {} },
        },
      ],
      tracks: { cta: { styleRef: { presetId: unused.id, overrides: {} } } },
      customPresets: { [mine.id]: mine, [unused.id]: unused },
    },
  )
  assert.equal(used.length, 2)
  assert.ok(used.some((item) => item.id === mine.id))
  assert.ok(used.some((item) => item.id === unused.id))
})
