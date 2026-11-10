import { MAX_AUDIO_FILE_BYTES, MAX_RENDER_UPLOAD_BYTES, type AudioTrack, type CompositionAudio } from "./types.ts"
import { usableLength } from "./range.ts"

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg"]

export function isAudioFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase()
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function audioFileError(file: { name: string; size: number }): string | null {
  if (!isAudioFileName(file.name)) return "Use um arquivo .mp3, .m4a, .aac, .wav ou .ogg."
  if (file.size <= 0) return "O arquivo de áudio está vazio."
  if (file.size > MAX_AUDIO_FILE_BYTES) return "Cada áudio pode ter no máximo 50 MB."
  return null
}

export function renderUploadError(videoBytes: number, audioBytes: readonly number[]): string | null {
  for (const size of audioBytes) {
    if (size > MAX_AUDIO_FILE_BYTES) return "Cada áudio pode ter no máximo 50 MB."
  }
  const total = Math.max(0, videoBytes) + audioBytes.reduce((sum, size) => sum + Math.max(0, size), 0)
  if (total > MAX_RENDER_UPLOAD_BYTES) {
    return "O envio passa de 200 MB (vídeo + áudios). Remova uma faixa ou use um arquivo menor."
  }
  return null
}

export function audioFormField(trackId: string): string {
  return `audio_${trackId}`
}

/** Faixas mudas ou em volume 0 não vão no render. */
export function tracksForRender(audio: CompositionAudio): AudioTrack[] {
  return audio.tracks.filter((track) => !track.muted && track.volume > 0 && usableLength(track) > 0)
}

export function guessAudioKind(durationSeconds: number): "music" | "voice" {
  return durationSeconds > 25 ? "music" : "voice"
}
