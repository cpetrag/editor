import { test } from "node:test"
import assert from "node:assert/strict"

import {
  cycleIndex,
  editorShortcutAction,
  transportShortcut,
  type ShortcutKeyEvent,
} from "./editor-shortcuts.ts"

function key(value: string, patch: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return { key: value, target: null, defaultPrevented: false, ...patch }
}

test("editorShortcutAction maps J/K/L, Home/End, F2 and help everywhere", () => {
  assert.equal(editorShortcutAction(key("j")), "seek-back")
  assert.equal(editorShortcutAction(key("K")), "toggle-play")
  assert.equal(editorShortcutAction(key("l")), "seek-forward")
  assert.equal(editorShortcutAction(key("Home")), "seek-start")
  assert.equal(editorShortcutAction(key("End")), "seek-end")
  assert.equal(editorShortcutAction(key("F2")), "edit-text")
  assert.equal(editorShortcutAction(key("?", { shiftKey: true })), "help")
})

test("editorShortcutAction leaves Enter, Tab, Esc and Space to buttons outside the workspace", () => {
  assert.equal(editorShortcutAction(key("Enter")), null)
  assert.equal(editorShortcutAction(key("Tab")), null)
  assert.equal(editorShortcutAction(key("Escape")), null)
  assert.equal(editorShortcutAction(key(" ")), null)
})

test("editorShortcutAction ignores modifiers and already handled events", () => {
  assert.equal(editorShortcutAction(key("k", { ctrlKey: true })), null)
  assert.equal(editorShortcutAction(key("j", { metaKey: true })), null)
  assert.equal(editorShortcutAction(key("L", { shiftKey: true })), null)
  assert.equal(editorShortcutAction(key("k", { defaultPrevented: true })), null)
})

test("transportShortcut maps playback, trim, history and ignores typing", () => {
  assert.equal(transportShortcut(key(" ")), "toggle-play")
  assert.equal(transportShortcut(key("s")), "split")
  assert.equal(transportShortcut(key("I")), "mark-in")
  assert.equal(transportShortcut(key("o")), "mark-out")
  assert.equal(transportShortcut(key("ArrowLeft")), "step-back-frame")
  assert.equal(transportShortcut(key("ArrowRight")), "step-forward-frame")
  assert.equal(transportShortcut(key("ArrowLeft", { shiftKey: true })), "step-back-second")
  assert.equal(transportShortcut(key("ArrowRight", { shiftKey: true })), "step-forward-second")
  assert.equal(transportShortcut(key("Home")), "seek-start")
  assert.equal(transportShortcut(key("End")), "seek-end")
  assert.equal(transportShortcut(key("Delete")), "delete-selection")
  assert.equal(transportShortcut(key("Backspace")), "delete-selection")
  assert.equal(transportShortcut(key("z", { ctrlKey: true })), "undo")
  assert.equal(transportShortcut(key("z", { metaKey: true, shiftKey: true })), "redo")
  assert.equal(transportShortcut(key("y", { ctrlKey: true })), "redo")
  assert.equal(transportShortcut(key("e", { ctrlKey: true })), "export")
  assert.equal(transportShortcut(key("e", { metaKey: true })), "export")
  assert.equal(transportShortcut(key("?", { shiftKey: true })), "help")
  assert.equal(transportShortcut(key("s", { ctrlKey: true })), null)
  assert.equal(transportShortcut(key("ArrowLeft", { altKey: true })), null)
  assert.equal(transportShortcut(key(" ", { defaultPrevented: true })), null)
})

test("cycleIndex wraps around in both directions", () => {
  assert.equal(cycleIndex(-1, 3, 1), 0)
  assert.equal(cycleIndex(-1, 3, -1), 2)
  assert.equal(cycleIndex(2, 3, 1), 0)
  assert.equal(cycleIndex(0, 3, -1), 2)
  assert.equal(cycleIndex(0, 0, 1), -1)
})
