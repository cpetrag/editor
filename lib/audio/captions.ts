import type { CaptionLine } from "../captions.ts"
import type { AudioTrack } from "./types.ts"

/**
 * Deslocamento quando o timestamp está no tempo do arquivo (0 = início do arquivo).
 * A amostra `trimIn` cai em `start` na timeline.
 */
export function captionTimestampOffset(track: Pick<AudioTrack, "start" | "trimIn">): number {
  return track.start - track.trimIn
}

export function offsetCaptionTimestamps(lines: readonly CaptionLine[], offset: number): CaptionLine[] {
  if (!offset) return lines.map((line) => ({ ...line, words: line.words.map((word) => ({ ...word })) }))
  return lines.map((line) => ({
    ...line,
    start: line.start + offset,
    words: line.words.map((word) => ({
      ...word,
      start: word.start + offset,
      end: word.end + offset,
    })),
  }))
}

/**
 * O recorte enviado ao Whisper começa em `trimIn`, então o tempo 0 da resposta
 * é o início do recorte. Somar `trimIn` devolve o tempo do arquivo; a fórmula
 * `start - trimIn` coloca isso na timeline.
 */
export function placeSlicedCaptionLines(
  lines: readonly CaptionLine[],
  track: Pick<AudioTrack, "start" | "trimIn">,
): CaptionLine[] {
  return offsetCaptionTimestamps(lines, track.trimIn + captionTimestampOffset(track))
}
