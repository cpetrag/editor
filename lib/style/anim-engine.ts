import { motionCss, type MotionCss } from "../motion/css.ts"
import { motionAt, type MotionSpec } from "../motion/engine.ts"
import { MOTION_IDENTITY, type MotionState } from "../motion/state.ts"
import type { AnimTarget, Animation } from "./types.ts"

export type AnimPose = MotionState

export const IDENTITY_POSE: AnimPose = MOTION_IDENTITY

export type AnimRecipeName = "pop" | "slide-up" | "zoom-out" | "blur-in" | "typewriter"

export type AnimRecipe = {
  from: AnimTarget
  easing?: Animation["enter"]["easing"]
  overshoot?: number
  unit?: Animation["unit"]
  staggerInFrames?: number
}

export const ANIM_RECIPES: Record<AnimRecipeName, AnimRecipe> = {
  pop: { from: { scale: 0.6 }, overshoot: 0.15, easing: "spring" },
  "slide-up": { from: { y: 24, opacity: 0 }, easing: "ease-out" },
  "zoom-out": { from: { scale: 1.35, opacity: 0 }, easing: "ease-out" },
  "blur-in": { from: { blur: 8, opacity: 0 }, easing: "ease-out" },
  typewriter: { from: { opacity: 0 }, unit: "letra", staggerInFrames: 2 },
}

export type AnimatedStyleInput = {
  anim: Animation
  indexInCard: number
  cardStartFrame: number
  cardDurationFrames: number
  frame: number
  fps: number
  unitCount?: number
  seed?: number
  accent?: string
}

export type AnimatedCss = MotionCss

function motionSpec(input: AnimatedStyleInput): MotionSpec {
  return {
    animation: input.anim,
    startFrame: input.cardStartFrame,
    durationInFrames: input.cardDurationFrames,
  }
}

export function applyAnimRecipe(base: Animation, name: AnimRecipeName): Animation {
  const recipe = ANIM_RECIPES[name]
  return {
    ...base,
    unit: recipe.unit ?? base.unit,
    enter: {
      ...base.enter,
      from: { ...base.enter.from, ...recipe.from },
      easing: recipe.easing ?? base.enter.easing,
      overshoot: recipe.overshoot ?? base.enter.overshoot,
      staggerInFrames: recipe.staggerInFrames ?? base.enter.staggerInFrames,
      durationInFrames:
        base.enter.durationInFrames > 0
          ? base.enter.durationInFrames
          : name === "typewriter"
            ? 1
            : 10,
    },
  }
}

export function recipeFromAnimation(anim: Animation): AnimRecipeName | null {
  if (anim.enter.recipeId && anim.enter.recipeId in ANIM_RECIPES) {
    return anim.enter.recipeId as AnimRecipeName
  }
  let best: AnimRecipeName | null = null
  let bestScore = 0
  for (const name of Object.keys(ANIM_RECIPES) as AnimRecipeName[]) {
    const recipe = ANIM_RECIPES[name]
    const fromEntries = Object.entries(recipe.from) as Array<[keyof AnimTarget, number]>
    if (fromEntries.length === 0) continue
    const allMatch = fromEntries.every(([key, value]) => anim.enter.from[key] === value)
    if (!allMatch) continue
    if (name === "typewriter" && anim.unit !== "letra") continue
    const distinctive = fromEntries.some(([key]) => key !== "opacity")
    if (!distinctive && name !== "typewriter") continue
    let score = fromEntries.length * 2
    if (recipe.easing && anim.enter.easing === recipe.easing) score += 1
    if (recipe.overshoot != null && anim.enter.overshoot === recipe.overshoot) score += 1
    if (recipe.unit && anim.unit === recipe.unit) score += 1
    if (score > bestScore) {
      bestScore = score
      best = name
    }
  }
  return bestScore > 0 ? best : null
}

export function animatedPoseAt(input: AnimatedStyleInput): AnimPose {
  return motionAt(
    input.frame,
    input.fps,
    motionSpec(input),
    input.indexInCard,
    input.unitCount ?? Math.max(1, input.indexInCard + 1),
    input.seed ?? 0,
  )
}

export function poseToCss(
  pose: AnimPose,
  options: { clipDir?: Animation["clipDir"]; origin?: Animation["origin"]; accent?: string } = {},
): AnimatedCss {
  return motionCss(pose, options)
}

export function animatedCssAt(input: AnimatedStyleInput): AnimatedCss {
  return poseToCss(animatedPoseAt(input), {
    clipDir: input.anim.clipDir,
    origin: input.anim.origin,
    accent: input.accent,
  })
}
