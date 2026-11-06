import { test } from "node:test"
import assert from "node:assert/strict"

import { panelScrollDelta } from "./scroll-panel.ts"

test("panelScrollDelta does nothing when the card is fully visible", () => {
  assert.equal(panelScrollDelta({ top: 120, bottom: 300 }, { top: 100, bottom: 700 }), 0)
})

test("panelScrollDelta aligns the card top with a margin when it is below the viewport", () => {
  assert.equal(panelScrollDelta({ top: 650, bottom: 900 }, { top: 100, bottom: 700 }), 542)
})

test("panelScrollDelta scrolls up when the card starts above the viewport", () => {
  assert.equal(panelScrollDelta({ top: 40, bottom: 200 }, { top: 100, bottom: 700 }), -68)
})
