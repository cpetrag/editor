import { test } from "node:test"
import assert from "node:assert/strict"

import { comboContentSummary, comboMainText, comboMatchesEtapa } from "./library-combo.ts"
import type { Template } from "./inserts.ts"

const combo: Template = {
  id: "frete",
  name: "Frete",
  description: "",
  beats: [
    { track: "gancho", atPct: 0.1, durPct: 0.5, kind: "text", presetId: "impacto", text: "ACHEI COM FRETE GRÁTIS", x: 50, y: 22, scale: 1 },
    { track: "prova", atPct: 0.1, durPct: 0.5, kind: "element", elementId: "selo-frete", text: "FRETE", x: 50, y: 48, scale: 1 },
    { track: "cta", atPct: 0.1, durPct: 0.4, kind: "text", presetId: "bloco", text: "CORRE", x: 50, y: 78, scale: 1 },
  ],
  inserts: [],
}

test("combo summary counts texts and seals", () => {
  assert.equal(comboContentSummary(combo), "2 textos · 1 selo")
  assert.equal(comboMainText(combo), "ACHEI COM FRETE GRÁTIS")
})

test("etapa filter keeps combos that use that stage", () => {
  assert.equal(comboMatchesEtapa(combo, "todos"), true)
  assert.equal(comboMatchesEtapa(combo, "prova"), true)
  assert.equal(comboMatchesEtapa(combo, "cta"), true)
})
