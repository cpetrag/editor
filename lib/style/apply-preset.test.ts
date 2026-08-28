import { test } from "node:test"
import assert from "node:assert/strict"

import {
  applyCaptionLook,
  applyFactoryPreset,
  applyLookToTextInserts,
  applyLookToTrack,
  activeCaptionLookId,
  captionStyleChips,
  carryCaptionStyleRef,
  chipsForContext,
  trackStyleForInsert,
} from "../style-preset.ts"
import { insertKind, type CompositionInsert } from "../composition.ts"
import { FACTORY_PRESET_IDS, factoryPresetsInGroup, PRESETS } from "./presets.ts"
import { fieldOrigin } from "./resolve-style.ts"

function caption(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: patch.id ?? "c1",
    type: "legenda",
    kind: "caption",
    start: patch.start ?? 0,
    duration: patch.duration ?? 2,
    text: patch.text ?? "pague 50% agora",
    words: patch.words ?? [
      { text: "pague", start: 0, end: 0.4 },
      { text: "50%", start: 0.4, end: 0.8 },
      { text: "agora", start: 0.8, end: 1.4 },
    ],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: "texto-livre",
    kind: "text",
    start: 16,
    duration: 3,
    text: "Comprar agora",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
    x: 50,
    y: 80,
    ...patch,
  }
}

test("chips de insert não misturam presets de legenda", () => {
  assert.deepEqual(chipsForContext(caption(), 20), [])
  assert.deepEqual(chipsForContext(null, 20), [])

  const cta = chipsForContext(textInsert({ start: 16 }), 20)
  assert.equal(cta[0]?.group, "cta")
  assert.deepEqual(
    cta.map((chip) => chip.id),
    ["carrinhoLaranja", "setaTexto", "urgencia"],
  )
  assert.ok(cta.every((chip) => chip.group !== "legenda"))
  assert.ok(!cta.some((chip) => chip.id === "hormozi"))
})

test("card de legendas: Limpo primeiro, depois Viral e os 8 factory; Selo Avaliação/Contador fora", () => {
  const chips = captionStyleChips()
  assert.equal(chips[0]?.id, "limpo")
  assert.equal(chips[1]?.id, "viral")
  assert.deepEqual(
    chips.slice(2).map((chip) => chip.id),
    factoryPresetsInGroup("legenda").map((chip) => chip.id),
  )
  assert.ok(!chips.some((chip) => chip.id === "seloAvaliacao" || chip.id === "contador"))
})

test("activeCaptionLookId: factory unânime ganha; senão captionPreset; sem legendas é vazio", () => {
  assert.equal(activeCaptionLookId([], "limpo"), null)
  assert.equal(activeCaptionLookId([caption()], "limpo"), "limpo")
  assert.equal(activeCaptionLookId([caption()], "viral"), "viral")
  assert.equal(
    activeCaptionLookId(
      [caption({ styleRef: { presetId: "hormozi", overrides: {} } })],
      "limpo",
    ),
    "hormozi",
  )
  assert.equal(
    activeCaptionLookId(
      [
        caption({ id: "a", styleRef: { presetId: "hormozi", overrides: {} } }),
        caption({ id: "b", start: 2, styleRef: { presetId: "karaoke", overrides: {} } }),
      ],
      "viral",
    ),
    null,
  )
})

test("applyCaptionLook Limpo tira factory das legendas; Hormozi carimba só legendas", () => {
  const inserts: CompositionInsert[] = [
    caption({ styleRef: { presetId: "hormozi", overrides: {} } }),
    textInsert({ styleRef: { presetId: "carrinhoLaranja", overrides: {} } }),
  ]
  const limpo = applyCaptionLook(inserts, "limpo", { videoDuration: 20 })
  assert.equal(limpo[0]?.styleRef, undefined)
  assert.equal(limpo[1]?.styleRef?.presetId, "carrinhoLaranja")

  const hormozi = applyCaptionLook(inserts, "hormozi", { videoDuration: 20 })
  assert.equal(hormozi[0]?.styleRef?.presetId, "hormozi")
  assert.equal(hormozi[1]?.styleRef?.presetId, "carrinhoLaranja")
})

test("aplicar hormozi grava styleRef em todas as legendas e preserva overrides", () => {
  const inserts: CompositionInsert[] = [
    caption({
      id: "c1",
      styleRef: { presetId: "legado", overrides: { text: { highlight: { color: "#ABC" } } } },
    }),
    caption({ id: "c2", start: 2, text: "frete grátis", words: [{ text: "frete", start: 2, end: 2.4 }] }),
    textInsert(),
  ]
  const next = applyFactoryPreset(inserts, "hormozi", { selectedId: null, videoDuration: 20 })
  assert.equal(next[0]?.styleRef?.presetId, "hormozi")
  assert.equal(next[0]?.styleRef?.overrides.text?.highlight?.color, "#ABC")
  assert.equal(next[1]?.styleRef?.presetId, "hormozi")
  assert.equal(next[2]?.styleRef, undefined)
})

test("umaPalavra reagrupa para 1 palavra por card ao ser aplicado", () => {
  const inserts = [caption()]
  const next = applyFactoryPreset(inserts, "umaPalavra", { selectedId: "c1", videoDuration: 20 })
  const captions = next.filter((insert) => insertKind(insert) === "caption")
  assert.equal(captions.length, 3)
  assert.ok(captions.every((insert) => (insert.words ?? []).length === 1))
  assert.ok(captions.every((insert) => insert.styleRef?.presetId === "umaPalavra"))
  const words = captions.flatMap((insert) => insert.words ?? [])
  assert.deepEqual(
    words.map((word) => word.text),
    ["pague", "50%", "agora"],
  )
})

test("aplicar carrinhoLaranja no insert selecionado não mexe nas legendas", () => {
  const inserts = [caption(), textInsert({ id: "cta-1" })]
  const next = applyFactoryPreset(inserts, "carrinhoLaranja", {
    selectedId: "cta-1",
    videoDuration: 20,
  })
  assert.equal(next[0]?.styleRef, undefined)
  assert.equal(next[1]?.styleRef?.presetId, "carrinhoLaranja")
})

test("faixa CTA com carrinhoLaranja não vaza para legendas", () => {
  const track = { styleRef: { presetId: "carrinhoLaranja" as const, overrides: {} } }
  const tracks = { cta: track }
  assert.equal(trackStyleForInsert(caption({ start: 16 }), tracks, 20), null)
  assert.equal(trackStyleForInsert(textInsert(), tracks, 20)?.styleRef?.presetId, "carrinhoLaranja")
  assert.equal(PRESETS.carrinhoLaranja?.group, "cta")
})

test("os 16 presets de fábrica aplicam sem erro", () => {
  const inserts = [caption(), textInsert({ id: "cta-1" })]
  for (const id of FACTORY_PRESET_IDS) {
    const next = applyFactoryPreset(inserts, id, {
      selectedId: "cta-1",
      videoDuration: 20,
    })
    assert.ok(Array.isArray(next), id)
    assert.ok(next.length >= 1, id)
  }
})

test("regenerar legendas copia o styleRef anterior (Hormozi não some)", () => {
  const previous = [
    caption({
      id: "old",
      styleRef: { presetId: "hormozi", overrides: { text: { highlight: { color: "#ABC" } } } },
    }),
  ]
  const incoming = [caption({ id: "new", text: "frete grátis" })]
  const stamped = carryCaptionStyleRef(previous, incoming)
  assert.equal(stamped[0]?.styleRef?.presetId, "hormozi")
  assert.equal(stamped[0]?.styleRef?.overrides.text?.highlight?.color, "#ABC")
  assert.equal(stamped[0]?.id, "new")
})

test("aplicar à faixa CTA grava só na faixa e legendas não herdam carrinho", () => {
  const gancho = textInsert({ id: "hook", start: 1 })
  const ctaA = textInsert({
    id: "cta-a",
    start: 16,
    styleRef: { presetId: "carrinhoLaranja", overrides: { text: { fontSize: 72 } } },
  })
  const ctaB = textInsert({ id: "cta-b", start: 17, text: "Garantir" })
  const cap = caption({ id: "cap", start: 16 })
  const { inserts, tracks } = applyLookToTrack(
    [gancho, ctaA, ctaB, cap],
    { gancho: { styleRef: { presetId: "manchete", overrides: {} } } },
    "cta",
    { presetId: "carrinhoLaranja", overrides: { text: { fontSize: 72 } } },
    20,
  )
  assert.equal(tracks.cta?.styleRef?.presetId, "carrinhoLaranja")
  assert.equal(tracks.cta?.styleRef?.overrides.text?.fontSize, 72)
  assert.equal(tracks.gancho?.styleRef?.presetId, "manchete")
  assert.equal(inserts[0]?.styleRef, undefined)
  assert.equal(inserts[1]?.styleRef?.presetId, "carrinhoLaranja")
  assert.deepEqual(inserts[1]?.styleRef?.overrides, {})
  assert.equal(inserts[2]?.styleRef?.presetId, "carrinhoLaranja")
  assert.deepEqual(inserts[2]?.styleRef?.overrides, {})
  assert.equal(inserts[3]?.styleRef, undefined)
  assert.equal(
    fieldOrigin("text.fontSize", inserts[1]!, tracks.cta ?? null, {}),
    "faixa",
  )
})

test("aplicar hormozi à faixa prova só pega legendas da prova", () => {
  const { inserts, tracks } = applyLookToTrack(
    [
      caption({ id: "g", start: 0 }),
      caption({ id: "p", start: 8 }),
      textInsert({ id: "txt", start: 8 }),
    ],
    undefined,
    "prova",
    { presetId: "hormozi", overrides: { text: { color: "#FFE600" } } },
    20,
  )
  assert.equal(tracks.prova?.styleRef?.presetId, "hormozi")
  assert.equal(inserts[0]?.styleRef, undefined)
  assert.equal(inserts[1]?.styleRef?.presetId, "hormozi")
  assert.deepEqual(inserts[1]?.styleRef?.overrides, {})
  assert.equal(inserts[2]?.styleRef, undefined)
})

test("aplicar a todos os inserts de texto não mexe em chip, legenda nem faixa", () => {
  const gancho = textInsert({ id: "hook", start: 1 })
  const cta = textInsert({ id: "cta", start: 16 })
  const chip: CompositionInsert = {
    id: "chip",
    type: "alerta-desconto",
    kind: "chip",
    start: 6,
    duration: 3,
    text: "50% OFF",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
  }
  const cap = caption({ id: "cap", start: 8 })
  const { inserts, tracks } = applyLookToTextInserts(
    [gancho, cta, chip, cap],
    { gancho: { styleRef: { presetId: "manchete", overrides: {} } } },
    { presetId: "impacto3D", overrides: { text: { fontSize: 90 } } },
  )
  assert.equal(inserts[0]?.styleRef?.presetId, "impacto3D")
  assert.deepEqual(inserts[0]?.styleRef?.overrides, {})
  assert.equal(inserts[1]?.styleRef?.presetId, "impacto3D")
  assert.equal(inserts[2]?.styleRef, undefined)
  assert.equal(inserts[3]?.styleRef, undefined)
  assert.equal(tracks.gancho?.styleRef?.presetId, "manchete")
  assert.equal(tracks.cta, undefined)
})

test("aplicar preset limpo descarta overrides do alvo", () => {
  const inserts = [
    caption({
      id: "c1",
      styleRef: { presetId: "hormozi", overrides: { text: { color: "#ABC" } } },
    }),
  ]
  const next = applyFactoryPreset(inserts, "karaoke", {
    selectedId: "c1",
    videoDuration: 20,
    mode: "clean",
  })
  assert.equal(next[0]?.styleRef?.presetId, "karaoke")
  assert.deepEqual(next[0]?.styleRef?.overrides, {})
})
