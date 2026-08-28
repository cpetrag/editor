import { test } from "node:test"
import assert from "node:assert/strict"

import { fieldOrigin } from "./resolve-style.ts"
import {
  ORIGIN_LABEL,
  SHADOW_SHORTCUTS,
  applyPresetToStyleRef,
  applyShadowShortcut,
  hasInsertOverrides,
  patchStyleRef,
  resetStyleField,
  resetStyleOverrides,
  workingStyleRef,
} from "./edit-style.ts"

test("patchStyleRef grava o campo no override do insert", () => {
  const next = patchStyleRef(
    { presetId: "hormozi", overrides: {} },
    "text.fontSize",
    80,
  )
  assert.equal(next.presetId, "hormozi")
  assert.equal(next.overrides.text?.fontSize, 80)
  assert.equal(
    fieldOrigin("text.fontSize", { styleRef: next }, null, {}),
    "insert",
  )
})

test("reset individual tira só aquele campo e o • some", () => {
  const current = patchStyleRef(
    { presetId: "hormozi", overrides: { text: { color: "#ABC", fontSize: 80 } } },
    "text.color",
    "#FFF",
  )
  const next = resetStyleField(current, "text.color")
  assert.equal(next.overrides.text?.fontSize, 80)
  assert.equal(next.overrides.text?.color, undefined)
  assert.equal(
    fieldOrigin("text.color", { styleRef: next }, null, {}),
    "preset",
  )
  assert.equal(
    fieldOrigin("text.fontSize", { styleRef: next }, null, {}),
    "insert",
  )
})

test("Resetar limpa só os overrides do insert e mantém o preset", () => {
  const next = resetStyleOverrides({
    presetId: "karaoke",
    overrides: { text: { color: "#0F0" }, animation: { unit: "letra" } },
  })
  assert.equal(next.presetId, "karaoke")
  assert.deepEqual(next.overrides, {})
  assert.equal(hasInsertOverrides(next), false)
})

test("trocar preset preserva overrides; aplicar limpo descarta", () => {
  const current = {
    presetId: "hormozi",
    overrides: { text: { color: "#FF00AA", rotation: 6 } },
  }
  const preserved = applyPresetToStyleRef(current, "karaoke", "preserve")
  assert.equal(preserved.presetId, "karaoke")
  assert.equal(preserved.overrides.text?.color, "#FF00AA")
  assert.equal(preserved.overrides.text?.rotation, undefined)

  const clean = applyPresetToStyleRef(current, "karaoke", "clean")
  assert.equal(clean.presetId, "karaoke")
  assert.deepEqual(clean.overrides, {})
})

test("atalho Dura escreve no array shadows e continua editável", () => {
  const next = applyShadowShortcut(
    { presetId: "legado", overrides: {} },
    "hard",
  )
  assert.deepEqual(next.overrides.text?.shadows, [
    { x: 6, y: 6, blur: 0, color: "#000000" },
  ])
  assert.deepEqual(SHADOW_SHORTCUTS.hard, next.overrides.text?.shadows)
  const edited = patchStyleRef(next, "text.shadows", [
    { x: 8, y: 8, blur: 0, color: "#FF6B00" },
  ])
  assert.deepEqual(edited.overrides.text?.shadows, [
    { x: 8, y: 8, blur: 0, color: "#FF6B00" },
  ])
})

test("tooltip de origem usa os 4 níveis", () => {
  assert.equal(ORIGIN_LABEL.preset, "Preset")
  assert.equal(ORIGIN_LABEL.projeto, "Projeto")
  assert.equal(ORIGIN_LABEL.faixa, "Faixa")
  assert.equal(ORIGIN_LABEL.insert, "Insert")
})

test("hasInsertOverrides ignora objeto vazio aninhado", () => {
  assert.equal(hasInsertOverrides({ presetId: "legado", overrides: { text: {} } }), false)
  assert.equal(
    hasInsertOverrides({ presetId: "legado", overrides: { text: { color: "#111" } } }),
    true,
  )
})

test("workingStyleRef usa o preset da faixa sem copiar os overrides", () => {
  const ref = workingStyleRef(
    {},
    { styleRef: { presetId: "carrinhoLaranja", overrides: { text: { fontSize: 72 } } } },
    {},
  )
  assert.equal(ref.presetId, "carrinhoLaranja")
  assert.deepEqual(ref.overrides, {})
})
