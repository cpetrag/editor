function mulberry32(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromId(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function wobblePolyline(
  points: Array<{ x: number; y: number }>,
  seed: number,
  amplitude: number,
): Array<{ x: number; y: number }> {
  const rand = mulberry32(seed || 1)
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point
    const dx = points[index + 1]!.x - points[index - 1]!.x
    const dy = points[index + 1]!.y - points[index - 1]!.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const jitter = (rand() - 0.5) * 2 * amplitude
    return { x: point.x + nx * jitter, y: point.y + ny * jitter }
  })
}

export function wobbleEllipse(
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  steps = 28,
): Array<{ x: number; y: number }> {
  const rand = mulberry32(seed || 1)
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    const r = radius * (0.92 + rand() * 0.16)
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r })
  }
  points.push(points[0]!)
  return points
}
