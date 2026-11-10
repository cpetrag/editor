import type { FitMode } from "../video/playback.ts"
import { audioTrimFrames } from "./trim-frames.ts"
import {
  AUDIO_VOLUME_MAX,
  isAudioKind,
  type AudioKind,
  type AudioTrack,
} from "./types.ts"

export interface OutputRange {
  start: number
  end: number
}

const MIN_SPAN = 0.05

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundHundredths(value: number): number {
  return Math.round(value * 100) / 100
}

/** Uma janela menor que um frame quebra o Remotion (`trimAfter` precisa passar de `trimBefore`). */
function openTrimToFrame(
  duration: number,
  trimIn: number,
  trimOut: number,
): { trimIn: number; trimOut: number } {
  const fits = (inn: number, out: number) =>
    audioTrimFrames({ duration, trimIn: inn, trimOut: out }, 30) !== null &&
    audioTrimFrames({ duration, trimIn: inn, trimOut: out }, 60) !== null
  if (fits(trimIn, trimOut) || !(duration > 0)) return { trimIn, trimOut }
  let nextIn = trimIn
  let nextOut = Math.min(duration, trimIn + MIN_SPAN)
  if (!fits(nextIn, nextOut)) {
    nextOut = duration
    nextIn = Math.max(0, duration - MIN_SPAN)
  }
  if (!fits(nextIn, nextOut)) return { trimIn, trimOut }
  return { trimIn: nextIn, trimOut: nextOut }
}

export function usableLength(track: Pick<AudioTrack, "trimIn" | "trimOut">): number {
  return Math.max(0, track.trimOut - track.trimIn)
}

/**
 * Intervalo em que a faixa ocupa a timeline, cortado na duração da composição.
 * Com `fit: "audio"` a locução não é cortada: o vídeo é que acompanha ela.
 */
export function trackOutputRange(
  track: AudioTrack,
  videoDuration: number,
  options?: { fit?: FitMode },
): OutputRange {
  const length = usableLength(track)
  const rawStart = Math.max(0, finite(track.start))
  const protectVoice = options?.fit === "audio" && track.kind === "voice" && !track.muted
  const limit = protectVoice
    ? Number.POSITIVE_INFINITY
    : videoDuration > 0
      ? videoDuration
      : Number.POSITIVE_INFINITY
  const start = Math.min(rawStart, limit)
  if (!(length > 0) || !(start < limit)) return { start, end: start }
  const naturalEnd = track.loop ? limit : start + length
  const end = Math.min(limit, Math.max(start, naturalEnd))
  return { start, end }
}

/**
 * Repara volume, fades e uma janela de corte vazia (`trimIn >= trimOut`).
 * Uma janela inválida vira um trecho curto no fim do arquivo, nunca o arquivo inteiro.
 */
export function clampTrack(track: AudioTrack, videoDuration: number): AudioTrack {
  const duration = Math.max(0, finite(track.duration))
  let trimIn = clamp(finite(track.trimIn), 0, duration)
  let trimOut = clamp(finite(track.trimOut), 0, duration)
  if (!(trimOut > trimIn + 1e-6)) {
    if (duration <= MIN_SPAN) {
      trimIn = 0
      trimOut = duration
    } else {
      trimOut = duration
      trimIn = Math.min(trimIn, duration - MIN_SPAN)
      if (!(trimOut > trimIn)) trimIn = Math.max(0, duration - MIN_SPAN)
    }
  }
  const opened = openTrimToFrame(duration, trimIn, trimOut)
  trimIn = opened.trimIn
  trimOut = opened.trimOut
  let start = Math.max(0, finite(track.start))
  if (videoDuration > 0) start = Math.min(start, videoDuration)
  const kind: AudioKind = isAudioKind(track.kind) ? track.kind : "sfx"
  return {
    ...track,
    kind,
    duration,
    start: roundHundredths(start),
    trimIn: roundHundredths(trimIn),
    trimOut: roundHundredths(trimOut),
    volume: clamp(finite(track.volume, 1), 0, AUDIO_VOLUME_MAX),
    fadeIn: Math.max(0, finite(track.fadeIn)),
    fadeOut: Math.max(0, finite(track.fadeOut)),
    loop: track.loop === true,
    muted: track.muted === true,
  }
}

/** Instante dentro do arquivo correspondente a `sourceTime` na timeline. */
export function fileTimeAt(track: AudioTrack, sourceTime: number, videoDuration: number): number | null {
  const range = trackOutputRange(track, videoDuration)
  if (!(sourceTime >= range.start) || !(sourceTime < range.end)) return null
  const length = usableLength(track)
  if (!(length > 0)) return null
  const into = sourceTime - track.start
  if (!track.loop && (into < 0 || into >= length)) return null
  const looped = track.loop ? ((into % length) + length) % length : into
  return track.trimIn + looped
}

export function moveAudioTrack(track: AudioTrack, start: number, videoDuration: number): AudioTrack {
  return clampTrack({ ...track, start }, videoDuration)
}

/** A borda esquerda anda junto: o início na timeline e o corte no arquivo. */
export function trimAudioInEdge(track: AudioTrack, edgeTime: number, videoDuration: number): AudioTrack {
  const delta = edgeTime - track.start
  const nextTrim = track.trimIn + delta
  const maxTrim = track.trimOut - MIN_SPAN
  const trimIn = clamp(nextTrim, 0, Math.max(0, maxTrim))
  const applied = trimIn - track.trimIn
  return clampTrack({ ...track, trimIn, start: track.start + applied }, videoDuration)
}

export function trimAudioOutEdge(track: AudioTrack, edgeTime: number, videoDuration: number): AudioTrack {
  const length = Math.max(MIN_SPAN, edgeTime - track.start)
  const trimOut = Math.min(track.duration, track.trimIn + length)
  return clampTrack({ ...track, trimOut }, videoDuration)
}
