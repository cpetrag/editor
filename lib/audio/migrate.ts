import { defaultCompositionAudio, type CompositionAudio } from "./types.ts"

/**
 * Projetos v6 não tinham mix. O default deixa o áudio do vídeo em 100%,
 * sem faixas, para o projeto abrir exatamente como antes.
 */
export function migrateV6toV7<T extends object>(value: T): T & { version: 7; audio: CompositionAudio } {
  const record = value as T & { audio?: CompositionAudio }
  return {
    ...record,
    version: 7,
    audio: record.audio ?? defaultCompositionAudio(),
  }
}
