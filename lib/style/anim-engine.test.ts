import { test } from "node:test"
import assert from "node:assert/strict"

import { LEGADO_STYLE } from "./presets.ts"
import type { Animation } from "./types.ts"
import {
  ANIM_RECIPES,
  IDENTITY_POSE,
  animatedCssAt,
  animatedPoseAt,
  applyAnimRecipe,
  recipeFromAnimation,
} from "./anim-engine.ts"

const FPS = 30

function anim(patch: Partial<Animation> = {}): Animation {
  return {
    ...LEGADO_STYLE.animation,
    enter: { ...LEGADO_STYLE.animation.enter },
    exit: { ...LEGADO_STYLE.animation.exit },
    loop: { ...LEGADO_STYLE.animation.loop },
    ...patch,
  }
}

function poseAt(
  animation: Animation,
  frame: number,
  extra: { index?: number; start?: number; duration?: number } = {},
) {
  return animatedPoseAt({
    anim: animation,
    indexInCard: extra.index ?? 0,
    cardStartFrame: extra.start ?? 0,
    cardDurationFrames: extra.duration ?? 90,
    frame,
    fps: FPS,
  })
}

test("animacao vazia (legado) e identidade em qualquer frame do card", () => {
  const idle = anim()
  assert.deepEqual(poseAt(idle, 0), IDENTITY_POSE)
  assert.deepEqual(poseAt(idle, 17), IDENTITY_POSE)
  assert.deepEqual(poseAt(idle, 89), IDENTITY_POSE)
})

test("linear: no meio da entrada a escala esta no ponto medio", () => {
  const enter = anim({
    enter: {
      from: { scale: 0.5, opacity: 0 },
      durationInFrames: 10,
      delayInFrames: 0,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 0,
    },
  })
  const mid = poseAt(enter, 5)
  assert.equal(mid.scale, 0.75)
  assert.equal(mid.opacity, 0.5)
})

test("antes do delay o unit permanece no from; depois da duracao clamp em identidade", () => {
  const delayed = anim({
    enter: {
      from: { y: 20, opacity: 0 },
      durationInFrames: 10,
      delayInFrames: 4,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 0,
    },
  })
  const before = poseAt(delayed, 3)
  assert.equal(before.y, 20)
  assert.equal(before.opacity, 0)
  const settled = poseAt(delayed, 4 + 10)
  assert.equal(settled.y, IDENTITY_POSE.y)
  assert.equal(settled.opacity, IDENTITY_POSE.opacity)
})

test("stagger atrasa o segundo unit sem afetar o primeiro", () => {
  const staggered = anim({
    unit: "palavra",
    enter: {
      from: { opacity: 0 },
      durationInFrames: 6,
      delayInFrames: 0,
      easing: "linear",
      overshoot: 0,
      staggerInFrames: 3,
    },
  })
  const first = poseAt(staggered, 0, { index: 0 })
  const second = poseAt(staggered, 0, { index: 1 })
  assert.equal(first.opacity, 0)
  assert.equal(second.opacity, 0)
  const firstMid = poseAt(staggered, 3, { index: 0 })
  const secondStillFrom = poseAt(staggered, 3, { index: 1 })
  assert.equal(firstMid.opacity, 0.5)
  assert.equal(secondStillFrom.opacity, 0)
})

test("saida linear interpola para o to no fim do card", () => {
  const leaving = anim({
    exit: {
      to: { opacity: 0 },
      durationInFrames: 10,
      easing: "linear",
    },
  })
  const midExit = poseAt(leaving, 85, { duration: 90 })
  assert.equal(midExit.opacity, 0.5)
})

test("spring com overshoot passa de 1 na escala", () => {
  const pop = anim({
    enter: {
      from: { scale: 0.6 },
      durationInFrames: 20,
      delayInFrames: 0,
      easing: "spring",
      overshoot: 0.15,
      staggerInFrames: 0,
    },
  })
  let maxScale = 0
  for (let frame = 0; frame <= 20; frame += 1) {
    maxScale = Math.max(maxScale, poseAt(pop, frame).scale)
  }
  assert.ok(maxScale > 1, `expected overshoot, got max scale ${maxScale}`)
})

test("mesmo frame do loop produz o mesmo estado (deterministico)", () => {
  const pulsing = anim({
    loop: { type: "pulse", amplitude: 0.04, speed: 1.2 },
  })
  const a = poseAt(pulsing, 41)
  const b = poseAt(pulsing, 41)
  assert.deepEqual(a, b)
  const later = poseAt(pulsing, 50)
  assert.notEqual(a.scale, later.scale)
})

test("named recipes sao dados: pop aplica from.scale 0.6 no frame 0", () => {
  assert.equal(ANIM_RECIPES.pop.from.scale, 0.6)
  assert.equal(ANIM_RECIPES.pop.overshoot, 0.15)
  assert.equal(ANIM_RECIPES.pop.easing, "spring")
  const withPop = applyAnimRecipe(anim(), "pop")
  assert.equal(poseAt(withPop, 0).scale, 0.6)
})

test("animatedCssAt sempre devolve transform + opacity, sem transition", () => {
  const css = animatedCssAt({
    anim: applyAnimRecipe(anim(), "slide-up"),
    indexInCard: 0,
    cardStartFrame: 0,
    cardDurationFrames: 90,
    frame: 0,
    fps: FPS,
  })
  assert.equal(typeof css.transform, "string")
  assert.match(css.transform, /translate/i)
  assert.equal(typeof css.opacity, "number")
  assert.equal("transition" in css, false)
})

test("scrube para um frame no meio nao depende de frames anteriores", () => {
  const moving = applyAnimRecipe(anim(), "slide-up")
  const jumped = poseAt(moving, 8)
  const walked = poseAt(moving, 1)
  void walked
  assert.equal(jumped.y, poseAt(moving, 8).y)
})

test("recipeFromAnimation reconhece pop e slide-up; legado vazio não chuta", () => {
  assert.equal(recipeFromAnimation(applyAnimRecipe(anim(), "pop")), "pop")
  assert.equal(recipeFromAnimation(applyAnimRecipe(anim(), "slide-up")), "slide-up")
  assert.equal(recipeFromAnimation(anim()), null)
})
