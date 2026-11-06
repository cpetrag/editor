import {
  isIdentitySourceTransform,
  parseSourceTransform,
  serializeSourceTransform,
  type SourceTransform,
} from "./source-transform.ts"

/**
 * Divisão do vídeo de fundo, em segundos do arquivo original. Cada divisão abre
 * um trecho que vai até a próxima; o trecho antes da primeira usa `source.transform`,
 * o que mantém projetos sem divisões exatamente como eram.
 */
export interface SourceCut {
  time: number
  transform?: SourceTransform
}

export interface SourceSegment {
  index: number
  start: number
  end: number
  transform?: SourceTransform
}

export interface SegmentedFraming {
  transform?: SourceTransform
  cuts?: SourceCut[]
}

export const MIN_SEGMENT_DURATION = 0.3

function roundHundredths(value: number): number {
  return Math.round(value * 100) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function withTransform(cut: SourceCut, transform: SourceTransform | undefined): SourceCut {
  return transform ? { time: cut.time, transform } : { time: cut.time }
}

function meaningfulTransform(transform: SourceTransform | undefined): SourceTransform | undefined {
  return transform && !isIdentitySourceTransform(transform) ? transform : undefined
}

/** 0 = trecho inicial; n = trecho aberto pela divisão `cuts[n - 1]`. */
export function segmentIndexAt(cuts: readonly SourceCut[] | undefined, time: number): number {
  // Props do render chegam como JSON cru do servidor; uma lista inválida vira "sem divisões".
  if (!Array.isArray(cuts)) return 0
  let index = 0
  for (const cut of cuts) {
    if (time < cut.time) break
    index += 1
  }
  return index
}

export function sourceTransformAt(
  framing: SegmentedFraming,
  time: number,
): SourceTransform | undefined {
  const index = segmentIndexAt(framing.cuts, time)
  return index === 0 ? framing.transform : framing.cuts?.[index - 1]?.transform
}

export function listSourceSegments(
  framing: SegmentedFraming,
  duration: number,
): SourceSegment[] {
  const cuts = framing.cuts ?? []
  const starts = [0, ...cuts.map((cut) => cut.time)]
  return starts.map((start, index) => {
    const transform = index === 0 ? framing.transform : cuts[index - 1].transform
    return {
      index,
      start,
      end: index < cuts.length ? cuts[index].time : Math.max(start, duration),
      ...(transform ? { transform } : {}),
    }
  })
}

function canCutAt(cuts: readonly SourceCut[], time: number, duration: number): boolean {
  if (!(time >= MIN_SEGMENT_DURATION && time <= duration - MIN_SEGMENT_DURATION)) return false
  return cuts.every((cut) => Math.abs(cut.time - time) >= MIN_SEGMENT_DURATION)
}

export function canSplitSourceAt(
  framing: SegmentedFraming,
  time: number,
  duration: number,
): boolean {
  return canCutAt(framing.cuts ?? [], roundHundredths(time), duration)
}

/** O trecho novo herda o zoom do trecho dividido; null quando fica curto demais. */
export function splitSourceAt(
  framing: SegmentedFraming,
  time: number,
  duration: number,
): SourceCut[] | null {
  const at = roundHundredths(time)
  const cuts = framing.cuts ?? []
  if (!canCutAt(cuts, at, duration)) return null
  const cut = withTransform({ time: at }, sourceTransformAt(framing, at))
  return [...cuts, cut].sort((a, b) => a.time - b.time)
}

/** Remover a divisão junta os dois trechos; o resultado fica com o zoom do anterior. */
export function removeSourceCut(
  cuts: readonly SourceCut[] | undefined,
  index: number,
): SourceCut[] | undefined {
  if (!cuts) return undefined
  const next = cuts.filter((_, cutIndex) => cutIndex !== index)
  return next.length > 0 ? next : undefined
}

export function setSegmentTransformAt(
  framing: SegmentedFraming,
  time: number,
  transform: SourceTransform | undefined,
): SegmentedFraming {
  const value = meaningfulTransform(transform)
  const index = segmentIndexAt(framing.cuts, time)
  if (index === 0) return { transform: value, cuts: framing.cuts }
  const cuts = (framing.cuts ?? []).map((cut, cutIndex) =>
    cutIndex === index - 1 ? withTransform(cut, value) : cut,
  )
  return { transform: framing.transform, cuts }
}

export function clearSegmentTransforms(framing: SegmentedFraming): SegmentedFraming {
  return { cuts: framing.cuts?.map((cut) => ({ time: cut.time })) }
}

export function hasAnySegmentTransform(framing: SegmentedFraming): boolean {
  return Boolean(framing.transform) || (framing.cuts ?? []).some((cut) => Boolean(cut.transform))
}

/**
 * Ordena e descarta divisões fora do vídeo ou coladas demais. Devolve o mesmo
 * array quando nada muda, para não invalidar memos a cada clamp da composição.
 */
export function clampSourceCuts(
  cuts: SourceCut[] | undefined,
  duration: number,
): SourceCut[] | undefined {
  if (!cuts || cuts.length === 0) return undefined
  if (!(duration > 0)) return cuts
  const kept: SourceCut[] = []
  for (const cut of [...cuts].sort((a, b) => a.time - b.time)) {
    const time = roundHundredths(cut.time)
    if (!canCutAt(kept, time, duration)) continue
    kept.push(time === cut.time ? cut : withTransform({ time }, cut.transform))
  }
  if (kept.length === 0) return undefined
  const unchanged = kept.length === cuts.length && kept.every((cut, index) => cut === cuts[index])
  return unchanged ? cuts : kept
}

export function parseSourceCuts(
  raw: unknown,
  duration: number,
  sourceWidth: number,
  sourceHeight: number,
): SourceCut[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const cuts: SourceCut[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const time = item.time
    if (typeof time !== "number" || !Number.isFinite(time) || time <= 0) continue
    const transform = parseSourceTransform(item.transform, sourceWidth, sourceHeight)
    cuts.push(withTransform({ time }, transform))
  }
  return duration > 0
    ? clampSourceCuts(cuts, duration)
    : cuts.length > 0
      ? cuts.sort((a, b) => a.time - b.time)
      : undefined
}

export function serializeSourceCuts(
  cuts: readonly SourceCut[],
): Array<{ time: number; transform?: SourceTransform & { space: "offset" } }> {
  return cuts.map((cut) => {
    const transform = meaningfulTransform(cut.transform)
    return transform
      ? { time: cut.time, transform: serializeSourceTransform(transform) }
      : { time: cut.time }
  })
}

export function applySegmentedFraming<T extends SegmentedFraming>(
  source: T,
  framing: SegmentedFraming,
): Omit<T, "transform" | "cuts"> & SegmentedFraming {
  const { transform: _transform, cuts: _cuts, ...rest } = source
  return {
    ...rest,
    ...(framing.transform ? { transform: framing.transform } : {}),
    ...(framing.cuts && framing.cuts.length > 0 ? { cuts: framing.cuts } : {}),
  }
}
