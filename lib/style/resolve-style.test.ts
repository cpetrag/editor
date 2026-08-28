import { test } from "node:test"
import assert from "node:assert/strict"

import { PRESETS } from "./presets.ts"
import { fieldOrigin, resolveStyle } from "./resolve-style.ts"
import type { InsertStyle, StyleRef } from "./types.ts"

function insert(styleRef?: StyleRef) {
  return { styleRef }
}

function track(styleRef?: StyleRef) {
  return { styleRef }
}

function project(styleRef?: StyleRef) {
  return { styleRef }
}

test("resolveStyle: override de insert vence faixa, que vence projeto, que vence preset", () => {
  const resolved = resolveStyle(
    insert({
      presetId: "legado",
      overrides: { text: { color: "#INSERT" } },
    }),
    track({
      presetId: "legado",
      overrides: { text: { color: "#FAIXA", fontSize: 72 } },
    }),
    project({
      presetId: "legado",
      overrides: { text: { color: "#PROJETO", fontSize: 64, fontWeight: 700 } },
    }),
  )

  assert.equal(resolved.text.color, "#INSERT")
  assert.equal(resolved.text.fontSize, 72)
  assert.equal(resolved.text.fontWeight, 700)
  assert.equal(resolved.text.fontFamily, PRESETS.legado.style.text.fontFamily)
})

test("resolveStyle: trocar presetId mantendo overrides produz merge correto", () => {
  const variant: InsertStyle = {
    ...PRESETS.legado.style,
    text: {
      ...PRESETS.legado.style.text,
      fontFamily: "Montserrat",
      fontSize: 84,
      color: "#00FF00",
    },
  }
  PRESETS["variant-a"] = {
    label: "Variant A",
    group: "legenda",
    style: variant,
  }

  try {
    const overrides: StyleRef["overrides"] = { text: { color: "#FF00AA", rotation: 6 } }
    const withLegado = resolveStyle(
      insert({ presetId: "legado", overrides }),
      null,
      project(),
    )
    const withVariant = resolveStyle(
      insert({ presetId: "variant-a", overrides }),
      null,
      project(),
    )

    assert.equal(withLegado.text.fontFamily, PRESETS.legado.style.text.fontFamily)
    assert.equal(withLegado.text.fontSize, PRESETS.legado.style.text.fontSize)
    assert.equal(withLegado.text.color, "#FF00AA")
    assert.equal(withLegado.text.rotation, 6)

    assert.equal(withVariant.text.fontFamily, "Montserrat")
    assert.equal(withVariant.text.fontSize, 84)
    assert.equal(withVariant.text.color, "#FF00AA")
    assert.equal(withVariant.text.rotation, 6)
  } finally {
    delete PRESETS["variant-a"]
  }
})

test("resolveStyle: presetId vem do styleRef mais próximo; overrides de todos os níveis ainda aplicam", () => {
  const variant: InsertStyle = {
    ...PRESETS.legado.style,
    text: { ...PRESETS.legado.style.text, fontFamily: "Anton", fontSize: 140 },
  }
  PRESETS["uma-palavra"] = {
    label: "Uma Palavra",
    group: "legenda",
    style: variant,
  }

  try {
    const resolved = resolveStyle(
      insert({ presetId: "uma-palavra", overrides: { text: { rotation: 3 } } }),
      track({
        presetId: "legado",
        overrides: { text: { letterSpacing: 0.04 } },
      }),
      project({
        presetId: "legado",
        overrides: { text: { opacity: 80 } },
      }),
    )
    assert.equal(resolved.text.fontFamily, "Anton")
    assert.equal(resolved.text.fontSize, 140)
    assert.equal(resolved.text.letterSpacing, 0.04)
    assert.equal(resolved.text.opacity, 80)
    assert.equal(resolved.text.rotation, 3)
  } finally {
    delete PRESETS["uma-palavra"]
  }
})

test("resolveStyle: arrays de sombra substituem em vez de mesclar por índice", () => {
  const withShadow: InsertStyle = {
    ...PRESETS.legado.style,
    text: {
      ...PRESETS.legado.style.text,
      shadows: [{ x: 0, y: 4, blur: 12, color: "rgba(0,0,0,0.5)" }],
    },
  }
  PRESETS["com-sombra"] = {
    label: "Com sombra",
    group: "legenda",
    style: withShadow,
  }

  try {
    const resolved = resolveStyle(
      insert({
        presetId: "com-sombra",
        overrides: {
          text: { shadows: [{ x: 8, y: 8, blur: 0, color: "#FF6B00" }] },
        },
      }),
      null,
      project(),
    )
    assert.deepEqual(resolved.text.shadows, [{ x: 8, y: 8, blur: 0, color: "#FF6B00" }])
  } finally {
    delete PRESETS["com-sombra"]
  }
})

test("fieldOrigin retorna o nível certo para cada campo", () => {
  const ins = insert({
    presetId: "legado",
    overrides: { text: { color: "#111111" } },
  })
  const faixa = track({
    presetId: "legado",
    overrides: { text: { fontSize: 72, highlight: { color: "#FFE600" } } },
  })
  const proj = project({
    presetId: "legado",
    overrides: { text: { fontWeight: 700, opacity: 90 } },
  })

  assert.equal(fieldOrigin("text.color", ins, faixa, proj), "insert")
  assert.equal(fieldOrigin("text.fontSize", ins, faixa, proj), "faixa")
  assert.equal(fieldOrigin("text.highlight.color", ins, faixa, proj), "faixa")
  assert.equal(fieldOrigin("text.fontWeight", ins, faixa, proj), "projeto")
  assert.equal(fieldOrigin("text.opacity", ins, faixa, proj), "projeto")
  assert.equal(fieldOrigin("text.fontFamily", ins, faixa, proj), "preset")
  assert.equal(fieldOrigin("animation.unit", ins, faixa, proj), "preset")
})

test("fieldOrigin: sem styleRef em nenhum nível, tudo vem do preset legado", () => {
  assert.equal(fieldOrigin("text.color", insert(), null, project()), "preset")
  assert.equal(fieldOrigin("text.x", insert(), track(), project()), "preset")
})
