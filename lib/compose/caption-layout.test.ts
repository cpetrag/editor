import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_CAPTION_STYLE,
  type CompositionInsert,
} from "../composition.ts"
import { PLAY_H } from "./layout.ts"
import { layoutInsertText } from "./layout-text.ts"
import { approxBox, hitTestOverlays } from "./hit-test.ts"
import {
  captionInsertForPlay,
  layoutCaptionInsertForPlay,
  layoutOverlayInsertForPlay,
  applyCaptionStylePatchToRefs,
} from "./caption-layout.ts"
import { resolveCaptionInsertStyle } from "../style/caption-map.ts"

const captionStyle = {
  ...DEFAULT_CAPTION_STYLE,
  x: 50,
  y: 72,
  fontSize: 64,
  fontFamily: "geist",
}

function caption(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "cap-1",
    type: "legenda",
    kind: "caption",
    start: 0,
    duration: 3,
    text: "Esse cupom",
    words: [],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

test("captionInsertForPlay usa x/y/fonte do Hormozi, não do captionStyle", () => {
  const insert = caption({
    styleRef: { presetId: "hormozi", overrides: {} },
  })
  const painted = resolveCaptionInsertStyle(insert, captionStyle, "viral", null, {})
  const display = captionInsertForPlay(insert, painted)
  assert.equal(display.y, 50)
  assert.equal(display.fontSize, 84)
  assert.equal(display.style?.fontFamily, "montserrat")
  assert.equal(display.style?.uppercase, true)
})

test("layoutCaptionInsertForPlay com Hormozi posiciona no centro, não em y=72", () => {
  const insert = caption({
    styleRef: { presetId: "hormozi", overrides: {} },
  })
  const display = layoutCaptionInsertForPlay(insert, captionStyle, "viral", null, {})
  const layout = layoutInsertText(display, "geist")
  assert.ok(layout)
  assert.ok(Math.abs(layout.cy - PLAY_H * 0.5) < 1)
  assert.ok(Math.abs(layout.cy - PLAY_H * 0.72) > 200)
})

test("hit-test segue o styleRef: acerta o centro Hormozi e erra o y do captionStyle", () => {
  const insert = caption({
    styleRef: { presetId: "hormozi", overrides: {} },
  })
  const display = layoutCaptionInsertForPlay(insert, captionStyle, "viral", null, {})
  const layout = layoutInsertText(display, "geist")
  assert.ok(layout)
  const layouts = new Map([[insert.id, layout]])
  const factoryY = PLAY_H * 0.5
  const legacyY = PLAY_H * 0.72
  const hitFactory = hitTestOverlays([insert], layout.cx, factoryY, 1, new Map(), new Map(), "geist", layouts)
  const hitLegacy = hitTestOverlays([insert], layout.cx, legacyY, 1, new Map(), new Map(), "geist", layouts)
  assert.equal(hitFactory?.id, insert.id)
  assert.equal(hitLegacy, null)
})

test("arrastar legenda factory grava y no styleRef para o paint acompanhar", () => {
  const inserts = [
    caption({
      id: "a",
      styleRef: { presetId: "hormozi", overrides: {} },
    }),
    caption({
      id: "b",
      start: 3,
      styleRef: { presetId: "hormozi", overrides: {} },
    }),
    {
      id: "chip",
      type: "alerta-desconto" as const,
      start: 0,
      duration: 2,
      text: "OFF",
      anchor: "top" as const,
      animIn: "none" as const,
      animOut: "none" as const,
    },
  ]
  const next = applyCaptionStylePatchToRefs(inserts, { y: 40, fontSize: 70 })
  assert.equal(next[0]?.styleRef?.overrides.text?.y, 40)
  assert.equal(next[0]?.styleRef?.overrides.text?.fontSize, 70)
  assert.equal(next[1]?.styleRef?.overrides.text?.y, 40)
  assert.equal(next[2]?.styleRef, undefined)
})

test("legenda legado não ganha styleRef só porque o captionStyle mudou", () => {
  const inserts = [caption()]
  const next = applyCaptionStylePatchToRefs(inserts, { y: 40 })
  assert.equal(next[0]?.styleRef, undefined)
})

test("layoutOverlayInsertForPlay stamps captionStyle.rotation", () => {
  const laid = layoutOverlayInsertForPlay(
    caption(),
    { ...DEFAULT_CAPTION_STYLE, rotation: 12 },
    "viral",
    null,
    {},
  )
  assert.equal(laid.style?.rotation, 12)
})

test("arrastar rotação grava text.rotation no styleRef da factory", () => {
  const inserts = [
    caption({
      styleRef: { presetId: "hormozi", overrides: {} },
    }),
  ]
  const next = applyCaptionStylePatchToRefs(inserts, { rotation: 18 })
  assert.equal(next[0]?.styleRef?.overrides.text?.rotation, 18)
})

test("approxBox de texto factory usa o layout resolvido, não o fontSize achatado", () => {
  const insert: CompositionInsert = {
    id: "txt-1",
    type: "texto-livre",
    kind: "text",
    start: 2.6,
    duration: 3,
    text: "Comprar agora",
    anchor: "center",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 35,
    fontSize: 40,
    styleRef: { presetId: "hormozi", overrides: {} },
  }
  const display = layoutOverlayInsertForPlay(insert, captionStyle, "viral", null, {})
  assert.equal(display.y, 50)
  assert.equal(display.fontSize, 84)
  const layout = layoutInsertText(display, "geist")
  const box = approxBox(display, 1, undefined, null, "geist", undefined, layout)
  assert.ok(box)
  assert.ok(Math.abs(box.cy - PLAY_H * 0.5) < 1)
})

test("approxBox da legenda Hormozi usa o layout resolvido", () => {
  const insert = caption({
    styleRef: { presetId: "hormozi", overrides: {} },
  })
  const display = layoutCaptionInsertForPlay(insert, captionStyle, "viral", null, {})
  const layout = layoutInsertText(display, "geist")
  const box = approxBox(display, 1, undefined, null, "geist", undefined, layout)
  assert.ok(box)
  assert.ok(Math.abs(box.cy - PLAY_H * 0.5) < 1)
})
