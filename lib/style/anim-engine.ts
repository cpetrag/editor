import type { AnimTarget, Animation } from "./types.ts"

export type AnimPose = {
  scale: number
  x: number
  y: number
  rotate: number
  opacity: number
  blur: number
}

export const IDENTITY_POSE: AnimPose = {
  scale: 1,
  x: 0,
  y: 0,
  rotate: 0,
  opacity: 1,
  blur: 0,
}

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
}

export type AnimatedCss = {
  transform: string
  opacity: number
  filter?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function bezierCoord(t: number, p1: number, p2: number): number {
  const mt = 1 - t
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t
}

function bezierDerivative(t: number, p1: number, p2: number): number {
  const mt = 1 - t
  return 3 * mt * mt * p1 + 6 * mt * t * (p2 - p1) + 3 * t * t * (1 - p2)
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  let t = x
  for (let i = 0; i < 8; i += 1) {
    const current = bezierCoord(t, x1, x2)
    const dx = bezierDerivative(t, x1, x2)
    if (Math.abs(dx) < 1e-6) break
    t = clamp(t - (current - x) / dx, 0, 1)
  }
  return bezierCoord(t, y1, y2)
}

function easeOut(t: number): number {
  return cubicBezier(0, 0, 0.58, 1, t)
}

function resolveTarget(partial: AnimTarget | undefined): AnimPose {
  return {
    scale: partial?.scale ?? IDENTITY_POSE.scale,
    x: partial?.x ?? IDENTITY_POSE.x,
    y: partial?.y ?? IDENTITY_POSE.y,
    rotate: partial?.rotate ?? IDENTITY_POSE.rotate,
    opacity: partial?.opacity ?? IDENTITY_POSE.opacity,
    blur: partial?.blur ?? IDENTITY_POSE.blur,
  }
}

function mixPose(from: AnimPose, to: AnimPose, t: number): AnimPose {
  return {
    scale: lerp(from.scale, to.scale, t),
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    rotate: lerp(from.rotate, to.rotate, t),
    opacity: lerp(from.opacity, to.opacity, t),
    blur: lerp(from.blur, to.blur, t),
  }
}

function springProgress(frame: number, fps: number, overshoot: number): number {
  if (frame <= 0) return 0
  const damping = Math.max(0.5, 12 - overshoot * 40)
  const stiffness = 100
  const mass = 1
  const t = frame / Math.max(1e-6, fps)
  const omega0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  if (zeta < 1) {
    const omega = omega0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega0 * t)
    return 1 - decay * (Math.cos(omega * t) + ((zeta * omega0) / omega) * Math.sin(omega * t))
  }
  if (Math.abs(zeta - 1) < 1e-6) {
    return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t)
  }
  const sq = Math.sqrt(zeta * zeta - 1)
  const r1 = -omega0 * (zeta - sq)
  const r2 = -omega0 * (zeta + sq)
  const c2 = 1 / (1 - r2 / r1)
  const c1 = 1 - c2
  return 1 - c1 * Math.exp(r1 * t) - c2 * Math.exp(r2 * t)
}

function progressAt(
  local: number,
  durationInFrames: number,
  easing: Animation["enter"]["easing"],
  overshoot: number,
  fps: number,
): number {
  if (durationInFrames <= 0) return local >= 0 ? 1 : 0
  if (easing === "spring") {
    return springProgress(local, fps, overshoot)
  }
  const linear = clamp(local / durationInFrames, 0, 1)
  if (easing === "ease-out") return easeOut(linear)
  return linear
}

function fittedPhaseDurations(
  anim: Animation,
  cardDurationFrames: number,
): { enter: number; exit: number } {
  let enter = Math.max(0, anim.enter.durationInFrames)
  let exit = Math.max(0, anim.exit.durationInFrames)
  const span = enter + exit
  if (span > cardDurationFrames && span > 0) {
    const k = cardDurationFrames / span
    enter *= k
    exit *= k
  }
  return { enter, exit }
}

function applyLoop(pose: AnimPose, loop: Animation["loop"], frame: number, fps: number): AnimPose {
  if (loop.type === "nenhum" || loop.amplitude === 0) return pose
  const time = frame / Math.max(1e-6, fps)
  const wave = Math.sin(2 * Math.PI * loop.speed * time)
  if (loop.type === "pulse") {
    return { ...pose, scale: pose.scale * (1 + loop.amplitude * wave) }
  }
  if (loop.type === "shake") {
    return { ...pose, x: pose.x + loop.amplitude * wave }
  }
  return { ...pose, y: pose.y + loop.amplitude * wave }
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
  const { anim, indexInCard, cardStartFrame, cardDurationFrames, frame, fps } = input
  const phases = fittedPhaseDurations(anim, cardDurationFrames)
  const local =
    frame - cardStartFrame - indexInCard * anim.enter.staggerInFrames - anim.enter.delayInFrames

  const from = resolveTarget(anim.enter.from)
  const toExit = resolveTarget(anim.exit.to)
  const cardLocal = frame - cardStartFrame
  const exitStart = cardDurationFrames - phases.exit

  let pose = IDENTITY_POSE
  if (phases.enter > 0 || anim.enter.durationInFrames === 0) {
    const enterProgress = progressAt(
      local,
      phases.enter,
      anim.enter.easing,
      anim.enter.overshoot,
      fps,
    )
    pose = mixPose(from, IDENTITY_POSE, enterProgress)
  }
  if (phases.exit > 0 && cardLocal >= exitStart) {
    const exitLocal = cardLocal - exitStart
    const exitProgress = progressAt(exitLocal, phases.exit, anim.exit.easing, 0, fps)
    pose = mixPose(IDENTITY_POSE, toExit, exitProgress)
  }

  return applyLoop(pose, anim.loop, frame, fps)
}

export function poseToCss(pose: AnimPose): AnimatedCss {
  const transform = `translate(${pose.x}px, ${pose.y}px) scale(${pose.scale}) rotate(${pose.rotate}deg)`
  const css: AnimatedCss = {
    transform,
    opacity: pose.opacity,
  }
  if (pose.blur > 0) css.filter = `blur(${pose.blur}px)`
  return css
}

export function animatedCssAt(input: AnimatedStyleInput): AnimatedCss {
  return poseToCss(animatedPoseAt(input))
}
