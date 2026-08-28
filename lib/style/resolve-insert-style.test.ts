import assert from "node:assert/strict"
import { test } from "node:test"

import type { CompositionInsert } from "../composition.ts"
import { clampFontWeight } from "../compose/insert-style.ts"
import { applyTextPreset } from "../text-presets/apply.ts"
import { createInsert } from "../inserts.ts"
import {
  resolveInsertStyle,
  toComposeInsertStyle,
} from "./resolve-insert-style.ts"

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: "texto-livre",
    kind: "text",
    start: 0,
    duration: 3,
    text: "NOVO",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
    x: 50,
    y: 35,
    fontSize: 96,
    preset: "impacto",
    ...patch,
  }
}

test("resolveInsertStyle: unknown family falls back to inter and warns", () => {
  const warnings: string[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(String(args[0] ?? ""))
  }
  try {
    const resolved = resolveInsertStyle(
      textInsert({
        styleRef: {
          presetId: "legado",
          overrides: { text: { fontFamily: "Comic Sans MS" } },
        },
      }),
      {},
    )
    assert.equal(resolved.text.fontFamily, "inter")
    assert.ok(warnings.some((line) => line.includes("Comic Sans") && line.includes("inter")))
  } finally {
    console.warn = original
  }
})

test("resolveInsertStyle: single-weight font ignores snapped 800", () => {
  const resolved = resolveInsertStyle(
    textInsert({
      style: {
        fontFamily: "inter",
        fontWeight: 800,
        uppercase: true,
        color: "#FFFFFF",
        bgColor: null,
        strokeWidth: 8,
        strokeColor: "#000000",
        shadow: "hard",
        opacity: 1,
        rotation: 0,
      },
      styleRef: {
        presetId: "legado",
        overrides: { text: { fontFamily: "anton", fontWeight: 800 } },
      },
    }),
    {},
  )
  assert.equal(resolved.text.fontFamily, "anton")
  assert.equal(resolved.text.fontWeight, clampFontWeight("anton", 800))
  assert.equal(resolved.text.fontWeight, 400)
})

test("resolveInsertStyle: partial stroke.enabled override keeps the rest of the look", () => {
  const insert = applyTextPreset(createInsert("texto-livre"), "impacto")
  const resolved = resolveInsertStyle(
    {
      ...insert,
      style: insert.style
        ? { ...insert.style, fontFamily: "inter", strokeWidth: 12 }
        : insert.style,
      styleRef: {
        presetId: "legado",
        overrides: { text: { stroke: { enabled: false } } },
      },
    },
    {},
  )
  assert.equal(resolved.text.fontFamily, "anton")
  assert.equal(resolved.text.stroke.enabled, false)
  assert.ok((resolved.text.stroke.width ?? 0) > 0)
  assert.equal(resolved.text.textTransform, "uppercase")
})

test("toComposeInsertStyle follows the resolved paint, not the stale legacy style", () => {
  const resolved = resolveInsertStyle(
    textInsert({
      style: {
        fontFamily: "inter",
        fontWeight: 800,
        uppercase: false,
        color: "#111111",
        bgColor: "#FFFFFF",
        strokeWidth: 12,
        strokeColor: "#FF0000",
        shadow: "none",
        opacity: 1,
        rotation: 0,
      },
      styleRef: {
        presetId: "legado",
        overrides: { text: { fontFamily: "playfair", color: "#00FF00" } },
      },
    }),
    {},
  )
  const compose = toComposeInsertStyle(resolved)
  assert.equal(compose.fontFamily, "playfair")
  assert.equal(compose.color, "#00FF00")
})
