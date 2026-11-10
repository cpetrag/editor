export interface ReverseChunk {
  start: number
  end: number
}

/** Acima desta duração o filtro `reverse` é fatiado: ele guarda o vídeo inteiro na RAM. */
export const REVERSE_CHUNK_THRESHOLD = 20
export const REVERSE_CHUNK_SECONDS = 5

/**
 * Pedacos na ordem em que entram no concat. Um vídeo curto é um pedaço só.
 * Um longo é invertido em blocos de 5 s e concatenado do fim para o início.
 */
export function reverseChunkPlan(
  duration: number,
  threshold = REVERSE_CHUNK_THRESHOLD,
  chunkSeconds = REVERSE_CHUNK_SECONDS,
): ReverseChunk[] {
  if (!(duration > 0)) return []
  if (duration <= threshold) return [{ start: 0, end: duration }]
  const forward: ReverseChunk[] = []
  for (let start = 0; start < duration - 1e-3; start += chunkSeconds) {
    forward.push({ start, end: Math.min(duration, start + chunkSeconds) })
  }
  return forward.reverse()
}

export function reverseFilterArgs(inputPath: string, outputPath: string, chunk: ReverseChunk): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    inputPath,
    "-ss",
    chunk.start.toFixed(3),
    "-to",
    chunk.end.toFixed(3),
    "-vf",
    "reverse",
    "-an",
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ]
}
