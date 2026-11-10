/** Um pico a cada 20 ms, o bastante para a timeline sem guardar o PCM. */
export const PEAK_STEP_SECONDS = 0.02

export function peaksFromChannel(
  samples: ArrayLike<number>,
  sampleRate: number,
  stepSeconds = PEAK_STEP_SECONDS,
): number[] {
  if (!(sampleRate > 0) || samples.length === 0) return []
  const bucket = Math.max(1, Math.round(sampleRate * stepSeconds))
  const peaks: number[] = []
  for (let index = 0; index < samples.length; index += bucket) {
    let max = 0
    const end = Math.min(samples.length, index + bucket)
    for (let cursor = index; cursor < end; cursor += 1) {
      const value = Math.abs(samples[cursor] ?? 0)
      if (value > max) max = value
    }
    peaks.push(Math.min(1, max))
  }
  return peaks
}

export function slicePeaks(
  peaks: readonly number[],
  duration: number,
  trimIn: number,
  trimOut: number,
): number[] {
  if (peaks.length === 0 || !(duration > 0)) return []
  const start = Math.max(0, Math.min(peaks.length, Math.floor((trimIn / duration) * peaks.length)))
  const end = Math.max(start + 1, Math.min(peaks.length, Math.ceil((trimOut / duration) * peaks.length)))
  return peaks.slice(start, end)
}
