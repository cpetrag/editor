export type CaptionBox = {
  left: number
  top: number
  width: number
  height: number
}

const DEFAULT_STEP = 16

export function visualBounds(input: {
  cx: number
  cy: number
  width: number
  height: number
  rotation?: number
}): CaptionBox {
  const rotation = input.rotation ?? 0
  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const width = input.width * cos + input.height * sin
  const height = input.width * sin + input.height * cos
  return {
    left: input.cx - width / 2,
    top: input.cy - height / 2,
    width,
    height,
  }
}

function overlaps(a: CaptionBox, b: CaptionBox): boolean {
  return a.left < b.left + b.width - 0.5 && b.left < a.left + a.width - 0.5 && a.top < b.top + b.height - 0.5 && b.top < a.top + a.height - 0.5
}

function hitsAny(box: CaptionBox, obstacles: readonly CaptionBox[]): boolean {
  return obstacles.some((obstacle) => overlaps(box, obstacle))
}

function fits(box: CaptionBox, safeTop: number, safeBottom: number): boolean {
  return box.top >= safeTop - 0.5 && box.top + box.height <= safeBottom + 0.5
}

/**
 * Sobe ou desce em passos, preferindo a posição original.
 * Empate de distância: sobe. Não grava estilo — só devolve o topo efetivo.
 */
export function dodgeCaptionTop(input: {
  caption: CaptionBox
  obstacles: readonly CaptionBox[]
  safeTop: number
  safeBottom: number
  step?: number
}): number {
  const step = input.step && input.step > 0 ? input.step : DEFAULT_STEP
  const origin = input.caption.top
  if (!hitsAny(input.caption, input.obstacles) && fits(input.caption, input.safeTop, input.safeBottom)) {
    return origin
  }
  const maxShift = Math.max(input.safeBottom - input.safeTop, input.caption.height)
  let best: number | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (let shift = step; shift <= maxShift + step; shift += step) {
    for (const direction of [-1, 1] as const) {
      const top = origin + direction * shift
      const moved = { ...input.caption, top }
      if (!fits(moved, input.safeTop, input.safeBottom)) continue
      if (hitsAny(moved, input.obstacles)) continue
      const dist = Math.abs(top - origin)
      if (dist < bestDist - 0.5 || (Math.abs(dist - bestDist) <= 0.5 && top < (best ?? top))) {
        best = top
        bestDist = dist
      }
    }
    if (best !== null && bestDist <= shift + 0.5) break
  }
  return best ?? origin
}

/** Transição curta no começo da linha. O alvo não muda no meio da frase. */
export function dodgeOffsetAt(
  time: number,
  lineStart: number,
  targetDelta: number,
  transition = 0.12,
): number {
  if (!(transition > 0)) return targetDelta
  const progress = Math.min(1, Math.max(0, (time - lineStart) / transition))
  const eased = 1 - (1 - progress) ** 2
  return targetDelta * eased
}
