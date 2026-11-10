export type AudioTrimFrames = {
  trimBefore?: number
  trimAfter?: number
}

/**
 * Frames do arquivo para o Remotion.
 * `trimAfter` é o frame em que a mídia termina, contado do início (o antigo `endAt`),
 * não a quantidade de frames cortados no fim.
 */
export function audioTrimFrames(
  track: { duration: number; trimIn: number; trimOut: number },
  fps: number,
): AudioTrimFrames | null {
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 30
  const duration = Number.isFinite(track.duration) ? Math.max(0, track.duration) : 0
  const trimIn = Number.isFinite(track.trimIn) ? Math.max(0, track.trimIn) : 0
  const trimOut = Number.isFinite(track.trimOut) ? Math.max(0, track.trimOut) : 0
  const trimBefore = Math.max(0, Math.round(trimIn * rate))
  const coversFile = duration > 0 && trimOut >= duration - 1e-6
  const endFrame = coversFile
    ? Math.max(0, Math.round(duration * rate))
    : Math.max(0, Math.round(trimOut * rate))
  if (!(endFrame >= trimBefore + 1)) return null
  return {
    trimBefore: trimBefore > 0 ? trimBefore : undefined,
    trimAfter: coversFile ? undefined : endFrame,
  }
}
