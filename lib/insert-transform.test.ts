import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_CAPTION_STYLE,
  type CompositionInsert,
} from "./composition.ts"
import {
  applyUserTransformPatch,
  isTransformStylePath,
  layoutTransform,
  migrateInsertTransform,
  omitTransformOverrides,
  resetInsertTransform,
  type InsertTransform,
} from "./insert-transform.ts"
import { applyCaptionLook } from "./style-preset.ts"
import { resolveCaptionInsertStyle } from "./style/caption-map.ts"
import { captionInsertForPlay } from "./compose/caption-layout.ts"
import { PRESETS } from "./style/presets.ts"

function caption(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "cap-1",
    type: "legenda",
    kind: "caption",
    start: 0,
    duration: 2,
    text: "TESTE DI TESTE",
    words: [{ text: "TESTE", start: 0, end: 1 }],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

function paintedFor(insert: CompositionInsert) {
  return resolveCaptionInsertStyle(insert, DEFAULT_CAPTION_STYLE, "viral", null, {})
}

test("isTransformStylePath cobre só posição/caixa, não tipografia", () => {
  assert.equal(isTransformStylePath("text.x"), true)
  assert.equal(isTransformStylePath("text.y"), true)
  assert.equal(isTransformStylePath("text.rotation"), true)
  assert.equal(isTransformStylePath("text.maxWidth"), true)
  assert.equal(isTransformStylePath("text.fontSize"), false)
  assert.equal(isTransformStylePath("text.color"), false)
})

test("arrastar grava transform.touchedByUser e o layout ignora o y do Hormozi", () => {
  const moved = applyUserTransformPatch(
    caption({ styleRef: { presetId: "hormozi", overrides: {} } }),
    { x: 50, y: 88 },
    { x: 50, y: 50, scale: 1, rotation: 0, maxWidth: 80, touchedByUser: false },
  )
  assert.equal(moved.transform?.touchedByUser, true)
  assert.equal(moved.transform?.y, 88)
  const painted = paintedFor(moved)
  assert.equal(painted.text.y, 50)
  assert.equal(layoutTransform(moved, painted).y, 88)
  const display = captionInsertForPlay(moved, painted)
  assert.equal(display.y, 88)
})

test("sem toque do usuário o Hormozi ainda usa o y do preset", () => {
  const insert = caption({ styleRef: { presetId: "hormozi", overrides: {} } })
  const painted = paintedFor(insert)
  assert.equal(layoutTransform(insert, painted).y, 50)
  assert.equal(captionInsertForPlay(insert, painted).y, 50)
})

test("trocar preset 5 vezes não mexe no transform tocado", () => {
  const start = applyUserTransformPatch(
    caption({ styleRef: { presetId: "hormozi", overrides: {} } }),
    { x: 50, y: 88, rotation: 8, maxWidth: 70 },
    { x: 50, y: 50, scale: 1, rotation: 0, maxWidth: 80, touchedByUser: false },
  )
  const looks = ["karaoke", "neon", "minimal", "hormozi", "limpo"] as const
  let inserts: CompositionInsert[] = [start]
  for (const look of looks) {
    inserts = applyCaptionLook(inserts, look, { videoDuration: 20 })
    assert.equal(inserts[0]?.transform?.y, 88, look)
    assert.equal(inserts[0]?.transform?.rotation, 8, look)
    assert.equal(inserts[0]?.transform?.maxWidth, 70, look)
    const painted = paintedFor(inserts[0]!)
    assert.equal(layoutTransform(inserts[0]!, painted).y, 88, look)
  }
})

test("omitTransformOverrides tira x/y/rotação/maxWidth e deixa a cor", () => {
  const next = omitTransformOverrides({
    text: { color: "#ABC", y: 40, rotation: 6, maxWidth: 60, fontSize: 72 },
  })
  assert.equal(next.text?.color, "#ABC")
  assert.equal(next.text?.fontSize, 72)
  assert.equal(next.text?.y, undefined)
  assert.equal(next.text?.rotation, undefined)
  assert.equal(next.text?.maxWidth, undefined)
})

test("resetInsertTransform devolve a posição ao preset e o estilo fica", () => {
  const moved = applyUserTransformPatch(
    caption({
      styleRef: { presetId: "hormozi", overrides: { text: { color: "#0F0", y: 88 } } },
    }),
    { y: 88 },
    { x: 50, y: 50, scale: 1, rotation: 0, maxWidth: 80, touchedByUser: false },
  )
  const reset = resetInsertTransform(moved)
  assert.equal(reset.transform, undefined)
  assert.equal(reset.styleRef?.overrides.text?.color, "#0F0")
  assert.equal(reset.styleRef?.overrides.text?.y, undefined)
  const painted = paintedFor(reset)
  assert.equal(layoutTransform(reset, painted).y, PRESETS.hormozi.style.text.y)
})

test("migrateInsertTransform promove override de y e x/y achatados", () => {
  const fromOverride = migrateInsertTransform(
    caption({
      styleRef: { presetId: "hormozi", overrides: { text: { y: 81, color: "#FFF" } } },
    }),
  )
  assert.equal(fromOverride.transform?.touchedByUser, true)
  assert.equal(fromOverride.transform?.y, 81)
  assert.equal(fromOverride.styleRef?.overrides.text?.color, "#FFF")

  const fromFlat = migrateInsertTransform(
    caption({ x: 40, y: 90, rotation: 12, maxWidthPct: 60 }),
  )
  assert.equal(fromFlat.transform?.touchedByUser, true)
  assert.equal(fromFlat.transform?.x, 40)
  assert.equal(fromFlat.transform?.y, 90)
  assert.equal(fromFlat.transform?.rotation, 12)
  assert.equal(fromFlat.transform?.maxWidth, 60)
})

test("migrateInsertTransform promove texto arrastado fora do padrão", () => {
  const migrated = migrateInsertTransform({
    id: "t1",
    type: "texto-livre",
    kind: "text",
    start: 1,
    duration: 2,
    text: "Gancho",
    anchor: "center",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 80,
  })
  assert.equal(migrated.transform?.touchedByUser, true)
  assert.equal(migrated.transform?.y, 80)
})

test("migrateInsertTransform usa captionStyle global se a posição saiu do padrão", () => {
  const migrated = migrateInsertTransform(caption(), {
    ...DEFAULT_CAPTION_STYLE,
    y: 86,
  })
  assert.equal(migrated.transform?.touchedByUser, true)
  assert.equal(migrated.transform?.y, 86)
})
