import type { AudioKind, AudioTrack, CompositionAudio } from "./types.ts"
import { guessAudioKind } from "./upload.ts"
import { clampTrack, trackOutputRange, usableLength } from "./range.ts"

/** Leva a faixa do relógio do arquivo para o relógio do render (0 = início do corte). */
export function shiftAudioToTrim(
  audio: CompositionAudio,
  trimStart: number,
  outputDuration: number,
): CompositionAudio {
  if (!(trimStart > 0)) {
    return {
      ...audio,
      tracks: audio.tracks.map((track) => clampTrack(track, outputDuration)),
    }
  }
  const tracks: AudioTrack[] = []
  for (const track of audio.tracks) {
    let start = track.start - trimStart
    let trimIn = track.trimIn
    if (start < -1e-4) {
      trimIn += -start
      start = 0
    }
    const usable = usableLength(track)
    if (track.loop && usable > 0 && trimIn >= track.trimOut) {
      const into = trimIn - track.trimIn
      trimIn = track.trimIn + (((into % usable) + usable) % usable)
    }
    if (!track.loop && trimIn >= track.trimOut - 0.04) continue
    const next = clampTrack({ ...track, start, trimIn }, outputDuration)
    const range = trackOutputRange(next, outputDuration)
    if (!(range.end > range.start)) continue
    tracks.push(next)
  }
  return { ...audio, tracks }
}

export function buildAudioTrack(input: {
  id: string
  kind: AudioKind
  fileId: string
  fileName: string
  duration: number
  videoDuration: number
}): AudioTrack {
  const video = input.videoDuration > 0 ? input.videoDuration : input.duration
  // A locução guarda o arquivo inteiro. Cortar trimOut no tamanho do vídeo
  // jogava fora o final da fala sem avisar.
  const trimOut =
    input.kind === "voice"
      ? input.duration
      : Math.min(input.duration, video > 0 ? video : input.duration)
  return clampTrack(
    {
      id: input.id,
      kind: input.kind,
      fileId: input.fileId,
      fileName: input.fileName,
      duration: input.duration,
      start: 0,
      trimIn: 0,
      trimOut,
      volume: input.kind === "music" ? 0.4 : 1,
      fadeIn: 0,
      fadeOut: input.kind === "music" ? 0.5 : 0,
      loop: input.kind === "music",
      muted: false,
    },
    video,
  )
}

export type PickedAudioFile = {
  id: string
  fileId: string
  fileName: string
  duration: number
  videoDuration: number
  /** Já existe uma locução. O palpite "locução" vira efeito. */
  voiceTaken: boolean
  /** "Substituir áudio": muta o original no mesmo passo em que a faixa nasce. */
  muteOriginal: boolean
  /** Quando o chamador já sabe o tipo (locução vinda do UGC). */
  kind?: AudioKind
}

/**
 * Arquivo escolhido vira faixa na hora, com o tipo sugerido pela duração.
 * Sem arquivo (seletor cancelado) o áudio não muda — inclusive o mudo do original.
 */
export function audioAfterFileChoice(
  audio: CompositionAudio,
  picked: PickedAudioFile | null,
): CompositionAudio {
  if (!picked) return audio
  const guessed = picked.kind ?? guessAudioKind(picked.duration)
  const kind: AudioKind = guessed === "voice" && picked.voiceTaken ? "sfx" : guessed
  const track = buildAudioTrack({
    id: picked.id,
    kind,
    fileId: picked.fileId,
    fileName: picked.fileName,
    duration: picked.duration,
    videoDuration: picked.videoDuration,
  })
  return {
    ...audio,
    original: picked.muteOriginal ? { ...audio.original, muted: true } : audio.original,
    tracks: [...audio.tracks, track],
  }
}

export function isMixSilent(audio: CompositionAudio): boolean {
  const original = !audio.original.muted && audio.original.volume > 0
  const active = audio.tracks.some((track) => !track.muted && track.volume > 0 && usableLength(track) > 0)
  return !original && !active
}
