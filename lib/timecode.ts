export type TimecodeDetail = "decimal" | "frame"

const DEFAULT_FPS = 30

function clock(seconds: number, fps: number) {
  const safeFps = fps > 0 ? Math.round(fps) : DEFAULT_FPS
  const totalFrames = Math.max(0, Math.round(Math.max(0, seconds) * safeFps))
  return {
    safeFps,
    frame: totalFrames % safeFps,
    wholeSeconds: Math.floor(totalFrames / safeFps),
  }
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0")
}

/**
 * Tempo do preview. `decimal` é `m:ss.d` (segundos com 1 casa).
 * `frame` é `m:ss · qN`, o quadro dentro do segundo.
 */
export function formatTimecode(
  seconds: number,
  fps = DEFAULT_FPS,
  detail: TimecodeDetail = "decimal",
): string {
  const { safeFps, frame, wholeSeconds } = clock(seconds, fps)
  if (detail === "frame") {
    const minutes = Math.floor(wholeSeconds / 60)
    const secs = wholeSeconds % 60
    return `${minutes}:${pad2(secs)} · q${frame}`
  }
  let tenths = Math.round((frame / safeFps) * 10)
  let total = wholeSeconds
  if (tenths >= 10) {
    tenths = 0
    total += 1
  }
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${pad2(secs)}.${tenths}`
}
