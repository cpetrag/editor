import { test } from "node:test"
import assert from "node:assert/strict"

import { DEFAULT_CAPTION_STYLE, insertKind, type CompositionInsert } from "./composition.ts"
import {
  CAPTION_TEXT_PLACEHOLDER,
  applyCaptionTransformToAll,
  applySharedCaptionVisual,
  captionStyleHost,
  captionStylePatchFromTransform,
  captionTextEditorState,
  countCaptionInserts,
  insertsTabSummary,
  nonCaptionInserts,
  stampCaptionVisual,
} from "./caption-panel.ts"
import { applyUserTransformPatch, defaultTransformForInsert } from "./insert-transform.ts"

function chip(id: string): CompositionInsert {
  return {
    id,
    type: "cupom",
    start: 1,
    duration: 2,
    text: "CUPOM",
    anchor: "top",
    animIn: "pop",
    animOut: "none",
  }
}

function caption(id: string, start: number, text: string): CompositionInsert {
  return {
    id,
    type: "legenda",
    kind: "caption",
    start,
    duration: 1.5,
    text,
    words: [],
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
  }
}

test("nonCaptionInserts drops captions and keeps chips", () => {
  const inserts = [caption("c1", 0, "oi"), chip("k1"), caption("c2", 3, "hoje")]
  const list = nonCaptionInserts(inserts)
  assert.deepEqual(list.map((item) => item.id), ["k1"])
  assert.equal(countCaptionInserts(inserts), 2)
  assert.equal(insertKind(list[0]!), "chip")
})

test("captionStyleHost prefers the selected caption else the first caption", () => {
  const inserts = [chip("k1"), caption("c1", 0, "oi"), caption("c2", 3, "hoje")]
  assert.equal(captionStyleHost(inserts, "c2")?.id, "c2")
  assert.equal(captionStyleHost(inserts, "k1")?.id, "c1")
  assert.equal(captionStyleHost(inserts, null)?.id, "c1")
  assert.equal(captionStyleHost([chip("k1")], "k1"), null)
})

test("captionTextEditorState is editing only when the selection is a caption", () => {
  const inserts = [chip("k1"), caption("c1", 0, "oi")]
  const editing = captionTextEditorState(inserts, "c1")
  assert.equal(editing.mode, "editing")
  if (editing.mode === "editing") assert.equal(editing.insert.text, "oi")
  const idle = captionTextEditorState(inserts, "k1")
  assert.equal(idle.mode, "placeholder")
  assert.equal(CAPTION_TEXT_PLACEHOLDER, "Clique uma legenda na timeline.")
})

test("applyCaptionTransformToAll moves every caption and leaves chips", () => {
  const inserts = [
    caption("c1", 0, "oi"),
    chip("k1"),
    caption("c2", 3, "hoje"),
  ]
  const next = applyCaptionTransformToAll(inserts, { y: 80, rotation: 12 })
  assert.equal(next[0]?.transform?.y, 80)
  assert.equal(next[0]?.transform?.rotation, 12)
  assert.equal(next[2]?.transform?.y, 80)
  assert.equal(next[2]?.transform?.touchedByUser, true)
  assert.equal(next[1]?.transform, undefined)
  assert.equal(next[1]?.id, "k1")
  assert.equal(captionStylePatchFromTransform({ y: 80, rotation: 12, maxWidth: 70 }).y, 80)
  assert.equal(captionStylePatchFromTransform({ y: 80, rotation: 12, maxWidth: 70 }).rotation, 12)
  assert.equal(captionStylePatchFromTransform({ y: 80, rotation: 12, maxWidth: 70 }).maxWidthPct, 70)
})

test("stampCaptionVisual copies host look onto every caption line", () => {
  const host = applyUserTransformPatch(
    {
      ...caption("c1", 0, "linha um"),
      styleRef: { presetId: "hormozi", overrides: { text: { fontSize: 90, color: "#FF00AA" } } },
    },
    { y: 81, x: 44 },
    defaultTransformForInsert(caption("c1", 0, "linha um")),
  )
  const other = caption("c2", 3, "linha dois")
  const next = stampCaptionVisual([host, chip("k1"), other], host)
  assert.equal(next[2]?.text, "linha dois")
  assert.equal(next[2]?.start, 3)
  assert.equal(next[2]?.transform?.y, 81)
  assert.equal(next[2]?.transform?.x, 44)
  assert.equal(next[2]?.styleRef?.presetId, "hormozi")
  assert.equal(next[2]?.styleRef?.overrides.text?.fontSize, 90)
  assert.equal(next[2]?.styleRef?.overrides.text?.color, "#FF00AA")
  assert.equal(next[1]?.id, "k1")
})

test("insertsTabSummary keeps applied inserts and separates pending from editing", () => {
  const text = { ...chip("t1"), type: "texto-livre" as const, kind: "text" as const, text: "Gancho" }
  const other = chip("k1")
  const line = caption("c1", 0, "fala")
  assert.deepEqual(insertsTabSummary([text, other, line], null), { applied: 2, badge: null })
  assert.deepEqual(insertsTabSummary([text], { id: "t1", created: true }), { applied: 0, badge: "pending" })
  assert.deepEqual(insertsTabSummary([text, other], { id: "t1", created: true }), {
    applied: 1,
    badge: "pending",
  })
  assert.deepEqual(insertsTabSummary([text, other], { id: "t1", created: false }), {
    applied: 2,
    badge: "editing",
  })
  assert.deepEqual(insertsTabSummary([text, line], { id: "c1", created: false }), {
    applied: 1,
    badge: null,
  })
})

test("applySharedCaptionVisual copies the host transform onto every line", () => {
  const host = applyUserTransformPatch(
    caption("c1", 0, "linha um"),
    { x: 44, y: 50 },
    defaultTransformForInsert(caption("c1", 0, "linha um")),
  )
  const other = caption("c2", 3, "linha dois")
  const next = applySharedCaptionVisual(
    [host, chip("k1"), other],
    DEFAULT_CAPTION_STYLE,
    { y: 80 },
    "c1",
  )
  assert.equal(next.captionStyle.y, 80)
  assert.equal(next.inserts[0]?.transform?.x, 44)
  assert.equal(next.inserts[0]?.transform?.y, 80)
  assert.equal(next.inserts[2]?.transform?.x, 44)
  assert.equal(next.inserts[2]?.transform?.y, 80)
  assert.equal(next.inserts[2]?.text, "linha dois")
  assert.equal(next.inserts[1]?.id, "k1")
})
