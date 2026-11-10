import assert from "node:assert/strict"
import test from "node:test"

import { getPresetStyle } from "../style/presets.ts"
import { deviceScaleOf, highlightBarRect, insertBackgroundMotion, paintMarkedInsert } from "./draw.ts"

test("marca-texto cobre a linha com folga e fica entre 52% e 92%", () => {
  const bar = highlightBarRect(
    { y: 0, height: 100, pieces: [{ x: 10, width: 80 }] },
    50,
  )
  assert.ok(bar)
  assert.equal(bar.w, 80 + 50 * 0.15 * 2)
  assert.equal(bar.h, 40)
  assert.ok(Math.abs(bar.cy - ( -50 + 52 + 20)) < 0.01)
  assert.equal(bar.cx, 10 - 7.5 + bar.w / 2)
})

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

test("sticker em letra não mostra a caixa no quadro zero", () => {
  const style = getPresetStyle("sticker")
  const letter = { ...style, animation: { ...style.animation, unit: "letra" as const } }
  const motion = { time: 0, fps: 30, start: 0, duration: 3, seed: "thumb" }
  const hidden = insertBackgroundMotion(letter, motion, 8)
  assert.equal(hidden?.opacity, 0)
  assert.equal(hidden?.scale, 0.9)
  const shown = insertBackgroundMotion(letter, { ...motion, time: 6 / 30 }, 8)
  assert.equal(shown?.opacity, 1)
  assert.equal(shown?.scale, 1)
  assert.equal(insertBackgroundMotion(style, motion, 1), null)
})
