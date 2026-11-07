export type EasingName =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "spring"
  | "back-in"
  | "back-out"
  | "elastic-out"
  | "bounce-out"

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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

/** CSS ease-out. O motor antigo usa esta curva; não trocar por easeOutCubic. */
function easeOutCss(t: number): number {
  return cubicBezier(0, 0, 0.58, 1, t)
}

function easeInCss(t: number): number {
  return cubicBezier(0.42, 0, 1, 1, t)
}

function easeInOutCss(t: number): number {
  return cubicBezier(0.42, 0, 0.58, 1, t)
}

function easeInBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return c3 * t * t * t - c1 * t * t
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const shifted = t - 1
  return 1 + c3 * shifted * shifted * shifted + c1 * shifted * shifted
}

function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3
  if (t === 0) return 0
  if (t === 1) return 1
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

function easeOutBounce(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}

const UNIT_EASING: Record<Exclude<EasingName, "spring">, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": easeInCss,
  "ease-out": easeOutCss,
  "ease-in-out": easeInOutCss,
  "back-in": easeInBack,
  "back-out": easeOutBack,
  "elastic-out": easeOutElastic,
  "bounce-out": easeOutBounce,
}

export const UNIT_EASINGS = Object.keys(UNIT_EASING) as Array<Exclude<EasingName, "spring">>

export function ease(name: EasingName, t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  if (name === "spring") return t
  return (UNIT_EASING[name] ?? UNIT_EASING.linear)(t)
}

/**
 * Mola do motor antigo: ω = 10, ζ = max(0.5, 12 − 40·overshoot) / 20.
 * O tempo entra em segundos (frame / fps), sem normalizar pela duração.
 */
export function springProgress(frame: number, fps: number, overshoot: number): number {
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
