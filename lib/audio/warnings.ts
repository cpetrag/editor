import type { ExportWarning, ExportWarningCode } from "../export-checklist.ts"
import type { AudioKind, AudioTrack, CompositionAudio } from "./types.ts"
import { trackOutputRange, usableLength } from "./range.ts"
import { audioTrimFrames } from "./trim-frames.ts"
import { volumeAtTime, volumeContextFor } from "./volume.ts"

const KIND_TITLE: Record<AudioKind, string> = {
  music: "Música",
  voice: "Locução",
  sfx: "Efeito",
}

function clock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const rest = safe - mins * 60
  const rounded = Math.round(rest * 10) / 10
  const whole = Math.floor(rounded + 1e-6)
  const frac = Math.round((rounded - whole) * 10)
  const carry = frac === 10
  const sec = carry ? whole + 1 : whole
  const tenth = carry ? 0 : frac
  return `${mins}:${String(sec).padStart(2, "0")},${tenth}`
}

function isActive(track: Pick<AudioTrack, "muted" | "volume" | "trimIn" | "trimOut">): boolean {
  return !track.muted && track.volume > 0 && usableLength(track) > 0
}

export function collectAudioWarnings(input: {
  audio: CompositionAudio
  videoDuration: number
  missingTrackIds?: readonly string[]
  saveToCapcut?: boolean
  importing?: boolean
  fps?: number
}): ExportWarning[] {
  const { audio, videoDuration } = input
  const fps = input.fps && input.fps > 0 ? input.fps : 30
  const warnings: ExportWarning[] = []
  if (input.importing) {
    warnings.push({
      id: "audio-pending",
      code: "audio-pending",
      insertIds: [],
      title: "Áudio não adicionado",
    })
  }
  const missing = new Set(input.missingTrackIds ?? [])
  const active = audio.tracks.filter((track) => isActive(track) && !missing.has(track.id))
  const originalAudible = !audio.original.muted && audio.original.volume > 0

  if (!originalAudible && active.length === 0 && videoDuration > 0) {
    warnings.push({
      id: "audio-silent",
      code: "audio-silent",
      insertIds: [],
      title: "O vídeo vai sair sem som",
    })
  }

  for (const track of audio.tracks) {
    if (missing.has(track.id)) {
      warnings.push({
        id: `audio-missing:${track.id}`,
        code: "audio-missing",
        insertIds: [track.id],
        title: `${track.fileName || "Áudio"} sem arquivo. Reenviar arquivo.`,
      })
      continue
    }
    if (!track.muted && track.volume > 0 && track.duration > 0 && !audioTrimFrames(track, fps)) {
      warnings.push({
        id: `audio-trim:${track.id}`,
        code: "audio-trim",
        insertIds: [track.id],
        title: `${KIND_TITLE[track.kind]} com corte inválido. A faixa não entra no vídeo.`,
      })
      continue
    }
    if (!isActive(track) || !(videoDuration > 0)) continue
    const range = trackOutputRange(track, videoDuration)
    const natural = track.start + usableLength(track)
    if (!track.loop && natural > videoDuration + 0.05 && range.end >= videoDuration - 0.001) {
      warnings.push({
        id: `audio-cut:${track.id}`,
        code: "audio-cut",
        insertIds: [track.id],
        title: `${KIND_TITLE[track.kind]} cortada em ${clock(videoDuration)}`,
      })
    }
    if (track.kind === "music" && !track.loop && range.end < videoDuration - 0.2) {
      const covered = audio.tracks.some((other) => {
        if (other.id === track.id || other.kind !== "music" || !isActive(other)) return false
        const otherRange = trackOutputRange(other, videoDuration)
        return other.loop || otherRange.end >= videoDuration - 0.2
      })
      if (!covered) {
        warnings.push({
          id: `audio-gap:${track.id}`,
          code: "audio-gap",
          insertIds: [track.id],
          title: `Música acaba em ${clock(range.end)} e o final do vídeo fica em silêncio.`,
        })
      }
    }
  }

  if (videoDuration > 0 && (originalAudible || active.length > 0)) {
    const ctx = volumeContextFor(audio, videoDuration)
    const marks = new Set<number>([0, videoDuration / 2])
    for (const track of active) {
      const range = trackOutputRange(track, videoDuration)
      marks.add(range.start)
      marks.add(Math.min(videoDuration, range.start + track.fadeIn))
      marks.add(Math.max(0, range.end - track.fadeOut))
      marks.add(Math.max(range.start, range.end - 0.05))
    }
    for (const voice of ctx.voiceRanges) {
      marks.add(voice.start + ctx.ducking.fade)
      marks.add((voice.start + voice.end) / 2)
    }
    let hot = false
    for (const time of marks) {
      if (!(time >= 0) || !(time < videoDuration)) continue
      let sum = originalAudible ? audio.original.volume : 0
      for (const track of active) sum += volumeAtTime(track, time, ctx)
      if (sum > 1 + 1e-3) {
        hot = true
        break
      }
    }
    if (hot) {
      const hasMusic = active.some((track) => track.kind === "music")
      warnings.push({
        id: "audio-clip",
        code: "audio-clip",
        insertIds: [],
        title: hasMusic
          ? "Risco de distorção. Baixe a música."
          : "Risco de distorção. Baixe um dos volumes.",
      })
    }
  }

  if (input.saveToCapcut) {
    const faded = audio.tracks.some((track) => track.fadeIn > 0 || track.fadeOut > 0)
    const ducked =
      audio.ducking.enabled &&
      audio.tracks.some((track) => track.kind === "music") &&
      audio.tracks.some((track) => track.kind === "voice")
    if (faded || ducked) {
      warnings.push({
        id: "audio-capcut",
        code: "audio-capcut",
        insertIds: [],
        title: "Fade e ducking ficam só no MP4",
      })
    }
  }

  return warnings
}

export const AUDIO_WARNING_LABELS: Record<
  Extract<ExportWarningCode, "audio-silent" | "audio-cut" | "audio-clip" | "audio-gap" | "audio-missing" | "audio-capcut" | "audio-trim">,
  string
> = {
  "audio-silent": "Sem som",
  "audio-cut": "Cortado no fim do vídeo",
  "audio-clip": "Risco de distorção",
  "audio-gap": "Silêncio no final",
  "audio-missing": "Arquivo ausente",
  "audio-capcut": "CapCut sem automação",
  "audio-trim": "Corte inválido",
}
