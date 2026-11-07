export type MotionState = {
  scale: number
  scaleX: number
  scaleY: number
  x: number
  y: number
  rotate: number
  rotateX: number
  rotateY: number
  skewX: number
  opacity: number
  blur: number
  clip: number
  jitter: number
  brightness: number
  glow: number
}

export const MOTION_IDENTITY: MotionState = {
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  x: 0,
  y: 0,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  skewX: 0,
  opacity: 1,
  blur: 0,
  clip: 0,
  jitter: 0,
  brightness: 1,
  glow: 0,
}

const DISTANCE_KEYS = [
  "scale",
  "scaleX",
  "scaleY",
  "x",
  "y",
  "rotate",
  "rotateX",
  "rotateY",
  "skewX",
  "blur",
  "jitter",
] as const

type DistanceKey = (typeof DISTANCE_KEYS)[number]

export function intensifyDistance(pose: MotionState, intensity: number): MotionState {
  if (intensity === 1) return pose
  const next = { ...pose }
  for (const key of DISTANCE_KEYS) {
    const identity = MOTION_IDENTITY[key]
    const value = pose[key]
    next[key] = (identity + (value - identity) * intensity) as MotionState[DistanceKey]
  }
  return next
}
