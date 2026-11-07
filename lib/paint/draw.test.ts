import assert from "node:assert/strict"
import test from "node:test"

import { getPresetStyle } from "../style/presets.ts"
import { deviceScaleOf, paintMarkedInsert } from "./draw.ts"

test("neon rosa pinta uma passada para cada sombra", () => {
  const shadows: number[] = []
  let fills = 0
  const ctx = new Proxy(
    {
      font: "",
      fillStyle: "",
      strokeStyle: "",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowColor: "transparent",
      globalAlpha: 1,
      lineWidth: 1,
      textAlign: "left",
      textBaseline: "middle",
      letterSpacing: "0px",
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop as keyof typeof target]
        return () => undefined
      },
      set(target, prop, value) {
        if (prop === "shadowBlur" && typeof value === "number" && value > 0) shadows.push(value)
        if (prop === "fillStyle" && value) fills += 0
        return Reflect.set(target, prop, value)
      },
    },
  ) as CanvasRenderingContext2D
  paintMarkedInsert(ctx, {
    text: "Oi",
    style: getPresetStyle("neon-rosa"),
    maxWidth: 2000,
    measure: (text, font) => text.length * font.size * 0.5,
    origin: { cx: 100, cy: 40 },
    brandKitId: "beleza",
  })
  const neon = getPresetStyle("neon-rosa").text.shadows
  assert.equal(neon.length, 3)
  assert.ok(shadows.length >= 3)
  assert.deepEqual(shadows.slice(0, 3), neon.map((shadow) => shadow.blur))
  assert.equal(deviceScaleOf({ getTransform: () => ({ a: 0.2, b: 0, c: 0, d: 0.2, e: 0, f: 0 }) } as CanvasRenderingContext2D), 0.2)
})
