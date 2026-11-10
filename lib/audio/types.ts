export type AudioKind = "music" | "voice" | "sfx"

export interface AudioTrack {
  id: string
  kind: AudioKind
  /** Blob no IndexedDB `editor-video` / `files`. */
  fileId: string
  fileName: string
  /** Duração do arquivo, em segundos. */
  duration: number
  /** Onde começa no tempo da timeline do editor (o mesmo relógio dos inserts). */
  start: number
  /** Corte inicial dentro do arquivo. */
  trimIn: number
  /** Corte final dentro do arquivo, exclusivo e <= duration. */
  trimOut: number
  /** 0..1.5 */
  volume: number
  fadeIn: number
  fadeOut: number
  loop: boolean
  muted: boolean
}

export interface CompositionAudio {
  original: { volume: number; muted: boolean }
  tracks: AudioTrack[]
  ducking: { enabled: boolean; amount: number; fade: number }
}

export const AUDIO_KINDS: readonly AudioKind[] = ["music", "voice", "sfx"]
export const MAX_AUDIO_TRACKS = 4
export const MAX_VOICE_TRACKS = 1
export const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024
export const MAX_RENDER_UPLOAD_BYTES = 200 * 1024 * 1024
export const AUDIO_VOLUME_MAX = 1.5
export const MUSIC_GUESS_SECONDS = 25

export const AUDIO_ACCEPT =
  ".mp3,.m4a,.aac,.wav,.ogg,audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,audio/x-m4a"

export function defaultCompositionAudio(): CompositionAudio {
  return {
    original: { volume: 1, muted: false },
    tracks: [],
    ducking: { enabled: true, amount: 0.65, fade: 0.25 },
  }
}

export function isAudioKind(value: unknown): value is AudioKind {
  return value === "music" || value === "voice" || value === "sfx"
}
