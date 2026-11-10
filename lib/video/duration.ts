import type { AudioTrack, CompositionAudio } from "../audio/types.ts"
import type { Composition } from "../composition.ts"
import { usableLength } from "../audio/range.ts"
import {
  DEFAULT_PLAYBACK,
  isIdentityPlayback,
  type SourcePlayback,
} from "./playback.ts"
import { buildVideoTimeline, type TimelineSource } from "./timeline.ts"
import { suggestFit, type FitSuggestion } from "./suggest.ts"

export function activeVoiceEnd(audio: CompositionAudio | undefined): number {
  let end = 0
  for (const track of audio?.tracks ?? []) {
    if (track.kind !== "voice" || track.muted || !(track.volume > 0)) continue
    end = Math.max(end, track.start + usableLength(track))
  }
  return end
}

export function naturalVideoSeconds(source: TimelineSource, playback: SourcePlayback): number {
  return buildVideoTimeline(source, { ...playback, fill: "none" }, Number.POSITIVE_INFINITY).duration
}

export function resolveOutputDuration(
  source: TimelineSource & { playback?: SourcePlayback },
  audio: CompositionAudio | undefined,
): number {
  const playback = source.playback ?? DEFAULT_PLAYBACK
  const natural = naturalVideoSeconds(source, playback)
  if (!(natural > 0) && !(source.duration > 0)) return 0
  if (playback.fit === "manual") {
    const target = playback.targetDuration && playback.targetDuration > 0 ? playback.targetDuration : natural
    return buildVideoTimeline(source, playback, target).duration
  }
  if (playback.fit === "audio") {
    const target = Math.max(natural, activeVoiceEnd(audio))
    return buildVideoTimeline(source, playback, target).duration
  }
  return natural
}

/** Relógio da timeline. Projeto sem playback continua no tamanho do arquivo. */
export function editorDuration(
  source: TimelineSource & { playback?: SourcePlayback },
  audio: CompositionAudio | undefined,
): number {
  if (!(source.duration > 0)) return 0
  if (isIdentityPlayback(source.playback)) return source.duration
  const output = resolveOutputDuration(source, audio)
  return output > 0 ? output : source.duration
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clipInsert<T extends { start: number; duration: number }>(insert: T, duration: number): T | null {
  let start = insert.start
  let length = insert.duration
  if (start >= duration - 0.02) return null
  if (start < 0) {
    length += start
    start = 0
  }
  if (start + length > duration) length = duration - start
  if (!(length > 0.05)) return null
  return { ...insert, start, duration: length }
}

/**
 * O gancho fica no início. O CTA guarda a distância até o fim.
 * Insert de CTA (papel ou começo na janela) anda com o fim; o resto fica.
 */
export function shiftLayoutForDuration<T extends { start: number; duration: number; role?: string }>(input: {
  previousDuration: number
  nextDuration: number
  retention?: { ganchoEnd: number; ctaStart: number }
  inserts: T[]
}): { retention?: { ganchoEnd: number; ctaStart: number }; inserts: T[] } {
  const previous = input.previousDuration
  const next = input.nextDuration
  if (!(previous > 0) || !(next > 0) || Math.abs(previous - next) < 1e-4) {
    return { retention: input.retention, inserts: input.inserts }
  }
  const delta = next - previous
  const oldCta = input.retention?.ctaStart
  const retention = input.retention
    ? {
        ganchoEnd: clamp(input.retention.ganchoEnd, 0, next),
        ctaStart: clamp(input.retention.ctaStart + delta, 0, next),
      }
    : undefined
  const inserts = input.inserts.flatMap((insert) => {
    const followsEnd = insert.role === "cta" || (oldCta != null && insert.start >= oldCta - 0.001)
    const moved = followsEnd ? { ...insert, start: insert.start + delta } : insert
    const clipped = clipInsert(moved, next)
    return clipped ? [clipped] : []
  })
  return { retention, inserts }
}

export function withPlayback(composition: Composition, playback: SourcePlayback): Composition {
  const previous = editorDuration(composition.source, composition.audio)
  const source = { ...composition.source, playback }
  const nextDuration = editorDuration(source, composition.audio)
  const shifted = shiftLayoutForDuration({
    previousDuration: previous,
    nextDuration,
    retention: composition.retention,
    inserts: composition.inserts,
  })
  return {
    ...composition,
    source,
    inserts: shifted.inserts,
    ...(shifted.retention ? { retention: shifted.retention } : {}),
  }
}

export function formatSecondsPt(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1).replace(".", ",")
}

export function voiceOverrun(
  source: TimelineSource & { playback?: SourcePlayback },
  audio: CompositionAudio | undefined,
): { voice: number; video: number; cut: number } | null {
  const playback = source.playback ?? DEFAULT_PLAYBACK
  if (playback.fit === "audio") return null
  const voice = activeVoiceEnd(audio)
  const video = editorDuration(source, audio)
  if (!(voice > video + 0.05)) return null
  return { voice, video, cut: voice - video }
}

export function voiceOverrunMessage(over: { voice: number; video: number; cut: number }): string {
  return `A locução tem ${formatSecondsPt(over.voice)} s e o vídeo ${formatSecondsPt(over.video)} s — ${formatSecondsPt(over.cut)} s seriam cortados`
}

export function fitSuggestionFor(
  source: TimelineSource,
  audio: CompositionAudio | undefined,
): FitSuggestion | null {
  const useful = naturalVideoSeconds(source, { ...DEFAULT_PLAYBACK, speed: 1 })
  const voice = activeVoiceEnd(audio)
  return suggestFit(useful > 0 ? useful : source.duration, voice)
}

/** Locução que o v8 cortou no tamanho do vídeo volta a ter o arquivo inteiro. */
export function restoreVoiceClampedToVideo(
  tracks: AudioTrack[],
  sourceDuration: number,
): AudioTrack[] {
  if (!(sourceDuration > 0)) return tracks
  return tracks.map((track) => {
    if (track.kind !== "voice" || track.muted) return track
    if (track.trimIn > 0.05) return track
    if (!(track.duration > sourceDuration + 0.2)) return track
    if (Math.abs(track.trimOut - sourceDuration) > 0.08) return track
    return { ...track, trimOut: Math.round(track.duration * 100) / 100 }
  })
}
