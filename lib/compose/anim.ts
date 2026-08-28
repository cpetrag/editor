import type { AnimPresetId, CompositionInsert } from "../composition.ts"

export interface AnimPose {
  opacity: number
  scale: number
  dx: number
  dy: number
  blurPx: number
  clipProgress: number
}

export const IDENTITY_POSE: AnimPose = {
  opacity: 1,
  scale: 1,
  dx: 0,
  dy: 0,
  blurPx: 0,
  clipProgress: 1,
}

export const ANIM_DURATION_SEC: Record<AnimPresetId, number> = {
  none: 0,
  pop: 0.45,
  "slide-up": 0.4,
  "blur-in": 0.45,
  typewriter: 0.6,
  shake: 0.5,
}

type AnimFields = Pick<CompositionInsert, "start" | "duration" | "animIn" | "animOut">

export function phaseDurations(insert: AnimFields): { inDur: number; outDur: number } {
  let inDur = ANIM_DURATION_SEC[insert.animIn]
  let outDur = ANIM_DURATION_SEC[insert.animOut]
  const span = inDur + outDur
  if (span > insert.duration && span > 0) {
    const k = insert.duration / span
    inDur *= k
    outDur *= k
  }
  return { inDur, outDur }
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
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
    t = clamp01(t - (current - x) / dx)
  }
  return bezierCoord(t, y1, y2)
}

const easePop = (t: number) => cubicBezier(0.34, 1.56, 0.64, 1, t)
const easeOut = (t: number) => cubicBezier(0, 0, 0.58, 1, t)
const easeInOut = (t: number) => cubicBezier(0.42, 0, 0.58, 1, t)

function steps18(p: number): number {
  if (p >= 1) return 1
  return Math.floor(clamp01(p) * 18) / 18
}

function keyframeValue(
  pLinear: number,
  keys: ReadonlyArray<{ at: number; value: number }>,
  ease: (t: number) => number,
): number {
  const first = keys[0]
  const last = keys[keys.length - 1]
  if (!first || !last) return 0
  if (pLinear <= first.at) return first.value
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1]
    const next = keys[i]
    if (!prev || !next) continue
    if (pLinear <= next.at) {
      const span = next.at - prev.at
      const local = span === 0 ? 1 : (pLinear - prev.at) / span
      return lerp(prev.value, next.value, ease(clamp01(local)))
    }
  }
  return last.value
}

function enterPose(preset: AnimPresetId, p: number): AnimPose {
  const t = clamp01(p)
  if (preset === "none") return { ...IDENTITY_POSE }
  if (preset === "pop") {
    return {
      ...IDENTITY_POSE,
      scale: keyframeValue(t, [
        { at: 0, value: 0.6 },
        { at: 0.6, value: 1.08 },
        { at: 1, value: 1 },
      ], easePop),
      opacity: keyframeValue(t, [
        { at: 0, value: 0 },
        { at: 0.6, value: 1 },
        { at: 1, value: 1 },
      ], easePop),
    }
  }
  if (preset === "slide-up") {
    return {
      ...IDENTITY_POSE,
      dy: lerp(14, 0, easeOut(t)),
      opacity: lerp(0, 1, easeOut(t)),
    }
  }
  if (preset === "blur-in") {
    return {
      ...IDENTITY_POSE,
      blurPx: lerp(8, 0, easeOut(t)),
      opacity: lerp(0, 1, easeOut(t)),
    }
  }
  if (preset === "typewriter") {
    return { ...IDENTITY_POSE, clipProgress: steps18(t) }
  }
  return {
    ...IDENTITY_POSE,
    dx: keyframeValue(t, [
      { at: 0, value: 0 },
      { at: 0.2, value: -4 },
      { at: 0.4, value: 4 },
      { at: 0.6, value: -3 },
      { at: 0.8, value: 3 },
      { at: 1, value: 0 },
    ], easeInOut),
  }
}

function exitPose(preset: AnimPresetId, p: number): AnimPose {
  const t = clamp01(p)
  if (preset === "none") return { ...IDENTITY_POSE }
  if (preset === "shake") {
    return { ...enterPose("shake", t), opacity: 1 - t }
  }
  return enterPose(preset, 1 - t)
}

export function animAt(insert: AnimFields, time: number): AnimPose {
  const localT = time - insert.start
  const { inDur, outDur } = phaseDurations(insert)
  if (inDur > 0 && localT < inDur) {
    return enterPose(insert.animIn, localT / inDur)
  }
  if (outDur > 0 && localT >= insert.duration - outDur) {
    return exitPose(insert.animOut, (localT - (insert.duration - outDur)) / outDur)
  }
  return { ...IDENTITY_POSE }
}

export function applyAnimPose(
  ctx: CanvasRenderingContext2D,
  pose: AnimPose,
  box: { cx: number; cy: number; w: number; h: number },
): void {
  ctx.translate(box.cx, box.cy)
  ctx.translate(pose.dx, pose.dy)
  ctx.scale(pose.scale, pose.scale)
  ctx.globalAlpha *= pose.opacity
  if (pose.blurPx > 0) ctx.filter = `blur(${pose.blurPx}px)`
  if (pose.clipProgress < 1) {
    ctx.beginPath()
    ctx.rect(-box.w / 2, -box.h / 2, box.w * pose.clipProgress, box.h)
    ctx.clip()
  }
  ctx.translate(-box.cx, -box.cy)
}
