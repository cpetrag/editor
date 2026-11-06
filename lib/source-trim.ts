/**
 * Janela de corte do vídeo de fundo, em segundos do arquivo original.
 * Inserts e legendas continuam no tempo do arquivo; só o render recorta.
 */
export interface SourceTrim {
  start: number
  end: number
}

export interface TrimWindow {
  start: number
  end: number
  duration: number
}

export const MIN_TRIM_DURATION = 0.5

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundHundredths(value: number): number {
  return Math.round(value * 100) / 100
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Devolve null quando a janela cobre o vídeo inteiro (sem corte). */
export function clampSourceTrim(
  trim: SourceTrim | null | undefined,
  sourceDuration: number,
): SourceTrim | null {
  if (!trim || !(sourceDuration > 0)) return null
  if (sourceDuration <= MIN_TRIM_DURATION) return null
  let start = roundHundredths(clamp(trim.start, 0, sourceDuration - MIN_TRIM_DURATION))
  let end = roundHundredths(clamp(trim.end, start + MIN_TRIM_DURATION, sourceDuration))
  if (end - start < MIN_TRIM_DURATION) {
    start = roundHundredths(Math.max(0, end - MIN_TRIM_DURATION))
  }
  if (start <= 0 && end >= sourceDuration - 0.005) return null
  if (end > sourceDuration) end = roundHundredths(sourceDuration)
  return { start, end }
}

export function resolveTrimWindow(source: {
  duration: number
  trim?: SourceTrim
}): TrimWindow {
  const duration = Math.max(0, source.duration)
  const trim = clampSourceTrim(source.trim, duration)
  if (!trim) return { start: 0, end: duration, duration }
  return { start: trim.start, end: trim.end, duration: roundHundredths(trim.end - trim.start) }
}

/** Marcar entrada depois da saída descarta a saída (volta ao fim do vídeo). */
export function markTrimIn(
  trim: SourceTrim | null | undefined,
  time: number,
  sourceDuration: number,
): SourceTrim | null {
  const end = trim?.end ?? sourceDuration
  const nextEnd = time > end - MIN_TRIM_DURATION ? sourceDuration : end
  return clampSourceTrim({ start: time, end: nextEnd }, sourceDuration)
}

/** Marcar saída antes da entrada descarta a entrada (volta ao início). */
export function markTrimOut(
  trim: SourceTrim | null | undefined,
  time: number,
  sourceDuration: number,
): SourceTrim | null {
  const start = trim?.start ?? 0
  const nextStart = time < start + MIN_TRIM_DURATION ? 0 : start
  return clampSourceTrim({ start: nextStart, end: time }, sourceDuration)
}

export function parseSourceTrim(raw: unknown, sourceDuration: number): SourceTrim | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  const start = asFinite(record.start)
  const end = asFinite(record.end)
  if (start === null || end === null) return null
  if (!(sourceDuration > 0)) {
    return end > start && start >= 0 ? { start, end } : null
  }
  return clampSourceTrim({ start, end }, sourceDuration)
}

/** Progresso 0–1 de um instante do arquivo dentro da janela de corte. */
export function trimProgress(time: number, window: TrimWindow): number {
  if (!(window.duration > 0)) return 0
  return clamp((time - window.start) / window.duration, 0, 1)
}

/** Restringe um instante (playhead) à janela de corte. */
export function clampToTrim(time: number, window: TrimWindow): number {
  return clamp(time, window.start, window.end)
}
