import { test } from "node:test"
import assert from "node:assert/strict"

import {
  canHandleInsertNudge,
  canHandlePreviewNudge,
  cycleOverlayMode,
  isInsideRovingGroup,
  shouldIgnoreGlobalKey,
  frameStepKeyAction,
  timelineKeyAction,
  timelineSelectionKey,
} from "./keyboard-scope.ts"

test("frameStepKeyAction anda 1 quadro, 10 com Shift, e aceita , .", () => {
  const base = { defaultPrevented: false, target: null }
  assert.equal(frameStepKeyAction({ ...base, key: "ArrowRight" }, null), 1)
  assert.equal(frameStepKeyAction({ ...base, key: "ArrowLeft" }, null), -1)
  assert.equal(frameStepKeyAction({ ...base, key: "ArrowRight", shiftKey: true }, null), 10)
  assert.equal(frameStepKeyAction({ ...base, key: "ArrowLeft", shiftKey: true }, null), -10)
  assert.equal(frameStepKeyAction({ ...base, key: "," }, null), -1)
  assert.equal(frameStepKeyAction({ ...base, key: "." }, { kind: "source" }), 1)
})

test("frameStepKeyAction ignora ↑ ↓, modificadores e eventos já tratados", () => {
  const base = { defaultPrevented: false, target: null }
  assert.equal(frameStepKeyAction({ ...base, key: "ArrowUp" }, null), null)
  assert.equal(frameStepKeyAction({ ...base, key: "ArrowRight", ctrlKey: true }, null), null)
  assert.equal(frameStepKeyAction({ ...base, key: "ArrowRight", altKey: true }, null), null)
  assert.equal(
    frameStepKeyAction({ ...base, key: "ArrowRight", defaultPrevented: true }, null),
    null,
  )
})

test("timelineKeyAction mapeia I/O/S e ignora modificadores e repetição", () => {
  const base = { defaultPrevented: false, target: null }
  assert.equal(timelineKeyAction({ ...base, key: "i" }), "in")
  assert.equal(timelineKeyAction({ ...base, key: "O" }), "out")
  assert.equal(timelineKeyAction({ ...base, key: "s" }), "split")
  assert.equal(timelineKeyAction({ ...base, key: "x" }), null)
  assert.equal(timelineKeyAction({ ...base, key: "i", ctrlKey: true }), null)
  assert.equal(timelineKeyAction({ ...base, key: "s", ctrlKey: true }), null)
  assert.equal(timelineKeyAction({ ...base, key: "o", metaKey: true }), null)
  assert.equal(timelineKeyAction({ ...base, key: "i", repeat: true }), null)
  assert.equal(timelineKeyAction({ ...base, key: "i", defaultPrevented: true }), null)
})

test("timelineSelectionKey separa Ctrl+A do restante e ignora setas sem Alt", () => {
  const base = { defaultPrevented: false, target: null }
  assert.equal(timelineSelectionKey({ ...base, key: "a", ctrlKey: true }, true), "select-all")
  assert.equal(timelineSelectionKey({ ...base, key: "a", metaKey: true }, false), null)
  assert.equal(timelineSelectionKey({ ...base, key: "Delete" }, false), "delete")
  assert.equal(timelineSelectionKey({ ...base, key: "d", ctrlKey: true }, false), "duplicate")
  assert.deepEqual(timelineSelectionKey({ ...base, key: "ArrowRight", altKey: true }, false), { nudge: 1 })
  assert.deepEqual(
    timelineSelectionKey({ ...base, key: "ArrowLeft", altKey: true, shiftKey: true }, false),
    { nudge: -10 },
  )
  assert.equal(timelineSelectionKey({ ...base, key: "ArrowRight" }, true), null)
  assert.equal(timelineSelectionKey({ ...base, key: "Delete", defaultPrevented: true }, true), null)
})

test("shouldIgnoreGlobalKey skips prevented events", () => {
  assert.equal(shouldIgnoreGlobalKey({ defaultPrevented: true, target: null }), true)
  assert.equal(shouldIgnoreGlobalKey({ defaultPrevented: false, target: null }), false)
})

test("canHandleInsertNudge is false without a preview or card target", () => {
  assert.equal(
    canHandleInsertNudge({ defaultPrevented: false, target: null }, "insert-1"),
    false,
  )
})

test("canHandlePreviewNudge is false without target even with source selected", () => {
  assert.equal(
    canHandlePreviewNudge({ defaultPrevented: false, target: null }, { kind: "source" }),
    false,
  )
})

test("isInsideRovingGroup is false without a DOM element", () => {
  assert.equal(isInsideRovingGroup(null), false)
})

test("cycleOverlayMode walks Limpo → Safe area → Feed and back", () => {
  assert.equal(cycleOverlayMode("none", "ArrowRight"), "safe")
  assert.equal(cycleOverlayMode("safe", "ArrowRight"), "feed")
  assert.equal(cycleOverlayMode("feed", "ArrowRight"), "none")
  assert.equal(cycleOverlayMode("none", "ArrowLeft"), "feed")
  assert.equal(cycleOverlayMode("none", "Enter"), null)
})
