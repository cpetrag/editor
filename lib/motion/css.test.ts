import assert from "node:assert/strict"
import { test } from "node:test"

import { MOTION_IDENTITY } from "./state.ts"
import { clipPathCss, frameGlowRadius, motionCss } from "./css.ts"

test("o CSS do preview não usa perspectiva e achata com rotateX/rotateY", () => {
  const css = motionCss({
    ...MOTION_IDENTITY,
    x: 12,
    y: -4,
    rotateX: 90,
    rotateY: 20,
    rotate: 3,
    skewX: 5,
    scaleX: 0.5,
    scaleY: 2,
  })
  assert.equal(css.transform.includes("perspective"), false)
  assert.equal(
    css.transform,
    "translate(12px, -4px) rotateX(90deg) rotateY(20deg) rotate(3deg) skewX(5deg) scale(0.5, 2)",
  )
})

test("blur e brilho usam o px do quadro 1080 vezes a escala do preview", () => {
  const pose = { ...MOTION_IDENTITY, blur: 8, glow: 0.5, brightness: 1.2 }
  const css = motionCss(pose, { accent: "#FFD400", pixelScale: 0.25 })
  assert.equal(frameGlowRadius(0.5), 8 + 24 * 0.5)
  assert.match(css.filter ?? "", /blur\(2px\)/)
  assert.match(css.filter ?? "", /brightness\(1\.2\)/)
  assert.match(css.filter ?? "", /drop-shadow\(0 0 5px #FFD400\)/)
})

test("clip do CSS guarda a folga de 30%", () => {
  assert.equal(clipPathCss(0, "esq"), "inset(-30% -30% -30% -30%)")
  assert.equal(clipPathCss(1, "esq"), "inset(-30% -30% -30% 130%)")
  assert.equal(clipPathCss(1, "dir"), "inset(-30% 130% -30% -30%)")
})
