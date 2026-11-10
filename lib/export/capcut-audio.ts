import type { CompositionAudio } from "../audio/types.ts"
import { tracksForRender } from "../audio/upload.ts"

export const CAPCUT_AUDIO_OMISSION = "Fade e ducking ficam só no MP4"

export type CapcutAudioPlacement = {
  id: string
  fileName: string
  kind: string
  start: number
  trimIn: number
  trimOut: number
  volume: number
  loop: boolean
}

/** O MP4 já sai mixado. Ao lado dele, cada faixa audível com o lugar na timeline. */
export function capcutAudioPlan(audio: CompositionAudio | null | undefined): {
  tracks: CapcutAudioPlacement[]
  omissions: string[]
} {
  if (!audio) return { tracks: [], omissions: [] }
  const audible = tracksForRender(audio)
  const tracks = audible.map((track) => ({
    id: track.id,
    fileName: track.fileName || `${track.id}.mp3`,
    kind: track.kind,
    start: track.start,
    trimIn: track.trimIn,
    trimOut: track.trimOut,
    volume: track.volume,
    loop: track.loop,
  }))
  const faded = audible.some((track) => track.fadeIn > 0 || track.fadeOut > 0)
  const ducked =
    audio.ducking.enabled &&
    audible.some((track) => track.kind === "music") &&
    audible.some((track) => track.kind === "voice")
  return { tracks, omissions: faded || ducked ? [CAPCUT_AUDIO_OMISSION] : [] }
}
