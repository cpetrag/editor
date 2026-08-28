import { test } from "node:test"
import assert from "node:assert/strict"

import {
  canHandleInsertNudge,
  canHandlePreviewNudge,
  cycleOverlayMode,
  isInsideRovingGroup,
  shouldIgnoreGlobalKey,
} from "./keyboard-scope.ts"

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
