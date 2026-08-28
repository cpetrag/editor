import { test } from "node:test"
import assert from "node:assert/strict"

import { applyAnimRecipe } from "./anim-engine.ts"
import { LEGADO_STYLE } from "./presets.ts"
import type { CompositionInsert } from "../composition.ts"
import {
  activeAnimRecipe,
  legadoPaintLabel,
  legacyInsertPatchFromStylePath,
  resolveStyleForEditor,
  usesFactoryPaint,
} from "./editor-style.ts"

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: "texto-livre",
    kind: "text",
    start: 2.6,
    duration: 3,
    text: "NOVO",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
    x: 50,
    y: 35,
    fontSize: 207,
    preset: "bold-outline",
    ...patch,
  }
}

test("legado sem styleRef de fábrica: o slider mostra insert.fontSize, não 56", () => {
  const insert = textInsert()
  assert.equal(usesFactoryPaint(insert, null, {}), false)
  const resolved = resolveStyleForEditor(insert, null, {})
  assert.equal(resolved.text.fontSize, 207)
  assert.equal(resolved.text.x, 50)
  assert.equal(resolved.text.y, 35)
})

test("legado mostra insert.rotation no painel", () => {
  const insert = textInsert({ rotation: 22 })
  const resolved = resolveStyleForEditor(insert, null, {})
  assert.equal(resolved.text.rotation, 22)
})

test("abrir o painel legado não exige gravar styleRef para mostrar o tamanho", () => {
  const insert = textInsert({ styleRef: undefined })
  const resolved = resolveStyleForEditor(insert, null, {})
  assert.equal(resolved.text.fontSize, 207)
  assert.equal(insert.styleRef, undefined)
})

test("Hormozi ignora insert.fontSize achatado e mostra o tamanho do preset", () => {
  const insert = textInsert({
    fontSize: 207,
    styleRef: { presetId: "hormozi", overrides: {} },
  })
  assert.equal(usesFactoryPaint(insert, null, {}), true)
  const resolved = resolveStyleForEditor(insert, null, {})
  assert.equal(resolved.text.fontSize, 84)
})

test("recipe ativo no legado vem de animIn mesmo com animação factory vazia", () => {
  const insert = textInsert({ animIn: "pop" })
  const resolved = resolveStyleForEditor(insert, null, {})
  assert.equal(activeAnimRecipe(insert, resolved), "pop")
})

test("recipe ativo no Hormozi é pop (spring + scale 0.6)", () => {
  const insert = textInsert({
    animIn: "none",
    styleRef: { presetId: "hormozi", overrides: {} },
  })
  const resolved = resolveStyleForEditor(insert, null, {})
  assert.equal(activeAnimRecipe(insert, resolved), "pop")
})

test("legado sem recipe conhecida deixa o grupo vazio", () => {
  const insert = textInsert({ animIn: "none" })
  const resolved = resolveStyleForEditor(insert, null, {})
  assert.equal(activeAnimRecipe(insert, resolved), null)
})

test("rótulo do dropdown legado inclui o preset de paint", () => {
  assert.equal(legadoPaintLabel("bold-outline"), "Outline")
  assert.equal(legadoPaintLabel("caption-box"), "Caixa")
})

test("patch de tamanho e recipe grava os campos achatados que o preview legado pinta", () => {
  const size = legacyInsertPatchFromStylePath("text.fontSize", 80)
  assert.equal(size.fontSize, 80)
  const popped = legacyInsertPatchFromStylePath(
    "animation",
    applyAnimRecipe(LEGADO_STYLE.animation, "pop"),
  )
  assert.equal(popped.animIn, "pop")
  const moved = legacyInsertPatchFromStylePath("text.x", 12)
  assert.equal(moved.x, 12)
  const rotated = legacyInsertPatchFromStylePath("text.rotation", 45)
  assert.equal(rotated.rotation, 45)
})
