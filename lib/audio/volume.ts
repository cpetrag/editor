import type { AudioTrack, CompositionAudio } from "./types.ts"
import { trackOutputRange, usableLength } from "./range.ts"

export interface VoiceRange {
  start: number
  end: number
}

export interface VolumeContext {
  videoDuration: number
  ducking: CompositionAudio["ducking"]
  voiceRanges: readonly VoiceRange[]
}

export function voiceRangesOf(
  audio: { tracks: readonly AudioTrack[] },
  videoDuration: number,
): VoiceRange[] {
  const ranges: VoiceRange[] = []
  for (const track of audio.tracks) {
    if (track.kind !== "voice" || track.muted || !(track.volume > 0)) continue
    const range = trackOutputRange(track, videoDuration)
    if (range.end > range.start) ranges.push(range)
  }
  return ranges
}

/** 0 fora da fala; 1 no meio, com rampa de `fade` segundos nas bordas do intervalo. */
export function duckAmountAt(time: number, ranges: readonly VoiceRange[], fade: number): number {
  let dip = 0
  for (const range of ranges) {
    if (!(time >= range.start) || !(time < range.end)) continue
    const edge = Math.min(time - range.start, range.end - time)
    const ramp = fade > 0 ? Math.min(1, Math.max(0, edge / fade)) : 1
    if (ramp > dip) dip = ramp
  }
  return dip
}

/**
 * Ganho linear da faixa em `time` (tempo da timeline).
 * Mudo e fora do intervalo valem 0. Ducking só multiplica música.
 */
export function volumeAtTime(track: AudioTrack, time: number, ctx: VolumeContext): number {
  if (track.muted || !(track.volume > 0)) return 0
  if (!(usableLength(track) > 0)) return 0
  const range = trackOutputRange(track, ctx.videoDuration)
  if (!(time >= range.start) || !(time < range.end)) return 0

  let gain = track.volume
  const fromStart = time - range.start
  const toEnd = range.end - time
  if (track.fadeIn > 0 && fromStart < track.fadeIn) gain *= fromStart / track.fadeIn
  if (track.fadeOut > 0 && toEnd < track.fadeOut) gain *= Math.max(0, toEnd / track.fadeOut)

  if (track.kind === "music" && ctx.ducking.enabled) {
    const dip = duckAmountAt(time, ctx.voiceRanges, ctx.ducking.fade)
    const floor = 1 - Math.min(1, Math.max(0, ctx.ducking.amount))
    gain *= 1 - dip * (1 - floor)
  }
  return gain
}

export function volumeContextFor(
  audio: {
    original: CompositionAudio["original"]
    ducking: CompositionAudio["ducking"]
    tracks: readonly AudioTrack[]
  },
  videoDuration: number,
): VolumeContext {
  return {
    videoDuration,
    ducking: audio.ducking,
    voiceRanges: voiceRangesOf(audio, videoDuration),
  }
}
