import type { AudioKind, CompositionAudio } from "./types.ts"

const SUMMARY_ORDER: readonly AudioKind[] = ["music", "voice", "sfx"]
const EXPORT_ORDER: readonly AudioKind[] = ["voice", "music", "sfx"]

const KIND_LABEL: Record<AudioKind, string> = {
  music: "música",
  voice: "locução",
  sfx: "efeito",
}

function presentKinds(audio: CompositionAudio, order: readonly AudioKind[]): AudioKind[] {
  const found = new Set(audio.tracks.map((track) => track.kind))
  return order.filter((kind) => found.has(kind))
}

function percent(volume: number): number {
  return Math.round(volume * 100)
}

function originalIsFull(audio: CompositionAudio): boolean {
  return !audio.original.muted && Math.abs(audio.original.volume - 1) < 0.005
}

/** Texto curto do cabeçalho do card, sem o ponto que o bloco já desenha. */
export function audioSummary(audio: CompositionAudio): string {
  const original = audio.original.muted
    ? "original mudo"
    : originalIsFull(audio)
      ? "original"
      : `original ${percent(audio.original.volume)}%`
  const kinds = presentKinds(audio, SUMMARY_ORDER).map((kind) => KIND_LABEL[kind])
  return [original, ...kinds].join(" · ")
}

function originalIsSilent(audio: CompositionAudio): boolean {
  return audio.original.muted || audio.original.volume <= 0
}

/** Frase do popover de export, no lugar de "com o áudio do vídeo". */
export function audioExportPhrase(audio: CompositionAudio): string {
  const kinds = presentKinds(audio, EXPORT_ORDER)
  if (originalIsSilent(audio) && kinds.length === 0) return "sem som"
  if (kinds.length === 0) return "com o áudio do vídeo"
  const parts = [
    ...(originalIsSilent(audio) ? [] : [`áudio do vídeo ${percent(audio.original.volume)}%`]),
    ...kinds.map((kind) => KIND_LABEL[kind]),
  ]
  const mix = `com ${parts.join(" + ")}`
  return originalIsSilent(audio) ? `${mix} (original mudo)` : mix
}
